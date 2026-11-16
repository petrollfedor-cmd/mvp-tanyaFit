"use client";

import { useMemo, useState } from "react";
import { CameraOutlined, CheckCircleFilled, RightOutlined, SafetyCertificateFilled } from "@ant-design/icons";
import { Alert, App, Avatar, Button, Card, Divider, Form, Input, InputNumber, Radio, Segmented, Space, Steps, Typography, Upload } from "antd";
import type { UploadFile } from "antd";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Goal = "lose" | "recompose" | "gain";
type DiaryMode = "fixed" | "dynamic";
type Experience = "under_1_year" | "one_to_three_years" | "over_3_years";
type Intensity = "low" | "medium" | "high";
type ProfileValues = { lastName: string; firstName: string };
type BodyValues = { sex: "female" | "male"; age: number; height: number; weight: number; waist: number; hips: number; thigh: number };
type PlanValues = { steps: number; cardioMinutes: number; cardioIntensity: Intensity; experience: Experience; trainingDays: number };

const bodyFatOptions = [
  { value: 14, label: "10–17%", description: "Низкий процент жира" },
  { value: 22.5, label: "20–25%", description: "Средний процент жира" },
  { value: 32, label: "30%+", description: "Высокий процент жира" },
] as const;

function recommendation(bodyFat: number): Goal {
  if (bodyFat >= 30) return "lose";
  if (bodyFat >= 20 && bodyFat <= 25) return "recompose";
  if (bodyFat >= 10 && bodyFat <= 17) return "gain";
  return "recompose";
}

function HeroAvatar() {
  return <Avatar size={88} className="hero-avatar" icon={<SafetyCertificateFilled />} />;
}

function BodySilhouette({ level }: { level: number }) {
  const waist = level === 14 ? 25 : level === 22.5 ? 34 : 44;
  return <svg className="body-silhouette" viewBox="0 0 100 150" role="img" aria-label="Нейтральный силуэт тела"><circle cx="50" cy="18" r="12" /><path d={`M39 34 C30 47 ${50 - waist / 5} 58 ${50 - waist / 10} 76 L31 117 L43 117 L50 88 L57 117 L69 117 L${50 + waist / 10} 76 C${50 + waist / 5} 58 70 47 61 34 Z`} /><path d="M43 115 L37 144 L47 144 L50 122 L53 144 L63 144 L57 115 Z" /></svg>;
}

export default function NutritionOnboarding({ session, onCompleted }: { session: Session; onCompleted: () => void }) {
  const { message } = App.useApp();
  const [step, setStep] = useState(0); const [saving, setSaving] = useState(false);
  const [profileForm] = Form.useForm<ProfileValues>(); const [bodyForm] = Form.useForm<BodyValues>(); const [planForm] = Form.useForm<PlanValues>();
  const [avatar, setAvatar] = useState<UploadFile[]>([]); const [photos, setPhotos] = useState<Record<"front" | "side" | "back", UploadFile[]>>({ front: [], side: [], back: [] });
  const [bodyFat, setBodyFat] = useState<number>(); const [goal, setGoal] = useState<Goal>(); const [mode, setMode] = useState<DiaryMode>(); const [detailsOpen, setDetailsOpen] = useState<DiaryMode | null>(null);
  const [profileValues, setProfileValues] = useState<ProfileValues | null>(null); const [bodyValues, setBodyValues] = useState<BodyValues | null>(null);
  const suggestedGoal = useMemo(() => bodyFat ? recommendation(bodyFat) : null, [bodyFat]);

  function nextProfile(values: ProfileValues) { setProfileValues(values); setStep(1); }
  function nextBody(values: BodyValues) { if (!photos.front.length || !photos.side.length || !photos.back.length) return message.error("Загрузите три стартовые фотографии: спереди, сбоку и сзади."); setBodyValues({ ...values, sex: values.sex ?? "female" }); setStep(2); }
  function chooseBodyFat(value: number) { setBodyFat(value); setGoal(recommendation(value)); }
  function nextGoal() { if (!bodyFat || !goal) return message.error("Выберите процент жира и цель."); setStep(3); }
  function selectMode(value: DiaryMode) { setMode(value); }
  async function upload(file: UploadFile | undefined, path: string) {
    if (!file?.originFileObj) return null;
    const { error } = await createClient().storage.from("profile-media").upload(path, file.originFileObj, { contentType: file.originFileObj.type, upsert: true });
    if (error) throw error;
    return path;
  }
  async function complete(plan?: PlanValues) {
    const identity = profileValues; const body = bodyValues;
    if (!identity?.firstName?.trim() || !identity.lastName?.trim() || !body) return message.error("Вернитесь к предыдущим шагам и заполните профиль и параметры тела.");
    if (!bodyFat || !goal || !mode) return message.error("Выберите процент жира, цель и формат питания.");
    if (mode === "fixed" && !plan) return message.error("Заполните данные активности для конструктора меню.");
    setSaving(true);
    try {
      const client = createClient(); const basePath = `${session.user.id}`;
      const [avatarPath, frontPath, sidePath, backPath] = await Promise.all([
        upload(avatar[0], `${basePath}/avatar.${avatar[0]?.name.split(".").pop() || "jpg"}`),
        upload(photos.front[0], `${basePath}/progress/${crypto.randomUUID()}-front.${photos.front[0]?.name.split(".").pop() || "jpg"}`),
        upload(photos.side[0], `${basePath}/progress/${crypto.randomUUID()}-side.${photos.side[0]?.name.split(".").pop() || "jpg"}`),
        upload(photos.back[0], `${basePath}/progress/${crypto.randomUUID()}-back.${photos.back[0]?.name.split(".").pop() || "jpg"}`),
      ]);
      if (!frontPath || !sidePath || !backPath) throw new Error("Не удалось загрузить стартовые фотографии.");
      const firstName = identity.firstName.trim(); const lastName = identity.lastName.trim();
      const { error: profileError } = await client.from("profiles").upsert({ id: session.user.id, first_name: firstName, last_name: lastName, display_name: firstName, avatar_path: avatarPath, sex: body.sex, age: body.age, height: body.height, weight: body.weight, waist_cm: body.waist, hips_cm: body.hips, thigh_cm: body.thigh, body_fat_percent: bodyFat, goal, nutrition_diary_mode: mode, planned_steps: mode === "fixed" ? plan?.steps : null, planned_cardio_minutes: mode === "fixed" ? plan?.cardioMinutes : null, planned_cardio_intensity: mode === "fixed" ? plan?.cardioIntensity : null, training_experience: mode === "fixed" ? plan?.experience : null, planned_training_days: mode === "fixed" ? plan?.trainingDays : null, onboarding_completed: true }, { onConflict: "id" });
      if (profileError) throw profileError;
      const { error: reportError } = await client.from("progress_reports").insert({ user_id: session.user.id, weight: body.weight, waist_cm: body.waist, hips_cm: body.hips, thigh_cm: body.thigh, front_photo_path: frontPath, side_photo_path: sidePath, back_photo_path: backPath });
      if (reportError) throw reportError;
      message.success("Анкета сохранена. Ваш план питания готов."); onCompleted();
    } catch (error) { message.error(error instanceof Error ? `Не удалось сохранить анкету: ${error.message}` : "Не удалось сохранить анкету."); } finally { setSaving(false); }
  }
  const photoInput = (position: "front" | "side" | "back", label: string) => <div className="progress-photo-field"><strong>{label}</strong><Upload listType="picture-card" maxCount={1} accept="image/jpeg,image/png,image/webp" capture="environment" fileList={photos[position]} beforeUpload={() => false} onChange={({ fileList }) => setPhotos((current) => ({ ...current, [position]: fileList.slice(-1) }))}>{!photos[position].length && <><CameraOutlined /><span>Фото</span></>}</Upload></div>;
  return <section className="onboarding onboarding-shell"><Typography.Text className="eyebrow">ПЕРВИЧНАЯ НАСТРОЙКА</Typography.Text><Typography.Title>Соберём ваш персональный план</Typography.Title><Typography.Paragraph>Это займёт несколько минут. Данные нужны для расчёта калорийности и отслеживания прогресса.</Typography.Paragraph><Card className="onboarding-card"><Steps current={step} size="small" items={[{ title: "Профиль" }, { title: "Анкета" }, { title: "Цель" }, { title: "Питание" }]} />
    {step === 0 && <Form form={profileForm} layout="vertical" onFinish={nextProfile}><div className="onboarding-profile"><div><Typography.Title level={3}>Как к вам обращаться?</Typography.Title><Typography.Paragraph type="secondary">Фамилия и имя обязательны. Аватар можно добавить сейчас или позже.</Typography.Paragraph><Form.Item name="lastName" label="Фамилия" rules={[{ required: true, whitespace: true, message: "Введите фамилию" }]}><Input size="large" autoComplete="family-name" /></Form.Item><Form.Item name="firstName" label="Имя" rules={[{ required: true, whitespace: true, message: "Введите имя" }]}><Input size="large" autoComplete="given-name" /></Form.Item></div><div className="avatar-upload"><Typography.Text strong>Ваш аватар</Typography.Text>{avatar.length ? <Upload listType="picture-circle" maxCount={1} accept="image/jpeg,image/png,image/webp" fileList={avatar} beforeUpload={() => false} onChange={({ fileList }) => setAvatar(fileList.slice(-1))} /> : <><HeroAvatar /><Upload maxCount={1} accept="image/jpeg,image/png,image/webp" fileList={avatar} beforeUpload={() => false} onChange={({ fileList }) => setAvatar(fileList.slice(-1))}><Button icon={<CameraOutlined />}>Загрузить фото</Button></Upload><Typography.Text type="secondary">Если пропустить — будет герой-аватар.</Typography.Text></>}</div></div><Button type="primary" size="large" htmlType="submit">Далее <RightOutlined /></Button></Form>}
    {step === 1 && <Form form={bodyForm} layout="vertical" initialValues={{ sex: "female" }} onFinish={nextBody}><Typography.Title level={3}>Параметры и стартовый отчёт</Typography.Title><div className="onboarding-form-grid"><Form.Item name="sex" label="Пол" rules={[{ required: true, message: "Выберите пол" }]}><Segmented block options={[{ value: "female", label: "Женский" }, { value: "male", label: "Мужской" }]} /></Form.Item><Form.Item name="age" label="Возраст" rules={[{ required: true, message: "Укажите возраст" }]}><InputNumber min={14} max={100} className="full-width" /></Form.Item><Form.Item name="height" label="Рост, см" rules={[{ required: true, message: "Укажите рост" }]}><InputNumber min={120} max={230} className="full-width" /></Form.Item><Form.Item name="weight" label="Вес, кг" rules={[{ required: true, message: "Укажите вес" }]}><InputNumber min={30} max={350} step={0.1} className="full-width" /></Form.Item><Form.Item name="waist" label="Обхват талии, см" rules={[{ required: true, message: "Укажите обхват талии" }]}><InputNumber min={30} max={250} step={0.1} className="full-width" /></Form.Item><Form.Item name="hips" label="Обхват бёдер, см" rules={[{ required: true, message: "Укажите обхват бёдер" }]}><InputNumber min={30} max={300} step={0.1} className="full-width" /></Form.Item><Form.Item name="thigh" label="Обхват одного бедра, см" rules={[{ required: true, message: "Укажите обхват бедра" }]}><InputNumber min={20} max={200} step={0.1} className="full-width" /></Form.Item></div><Divider /><Typography.Title level={4}>Три стартовые фотографии</Typography.Title><div className="progress-photo-grid">{photoInput("front", "Спереди")}{photoInput("side", "Сбоку")}{photoInput("back", "Сзади")}</div><Typography.Paragraph className="photo-guidelines">Телефон держите на уровне талии. Фотографируйтесь во весь рост, желательно на фоне пустой стены и в одинаковом белье в каждом отчёте — так изменения будет проще сравнивать.</Typography.Paragraph><Space><Button onClick={() => setStep(0)}>Назад</Button><Button type="primary" size="large" htmlType="submit">Далее <RightOutlined /></Button></Space></Form>}
    {step === 2 && <section><Typography.Title level={3}>Определите процент жира и цель</Typography.Title><Typography.Paragraph type="secondary">Выберите нейтральный силуэт, который больше всего похож на вас. Это ориентир для расчёта базовой калорийности.</Typography.Paragraph><div className="body-fat-grid">{bodyFatOptions.map((option) => <button key={option.value} type="button" className={`body-fat-card ${bodyFat === option.value ? "selected" : ""}`} onClick={() => chooseBodyFat(option.value)}><BodySilhouette level={option.value} /><strong>{option.label}</strong><span>{option.description}</span>{bodyFat === option.value && <CheckCircleFilled />}</button>)}</div>{suggestedGoal && <Alert type="success" showIcon title={`Рекомендация: ${suggestedGoal === "lose" ? "снижение процента жира" : suggestedGoal === "recompose" ? "рекомпозиция" : "набор мышечной массы"}`} description="Вы можете выбрать другую цель, но рекомендация учитывает выбранный процент жира." />}<Typography.Title level={4}>Выберите цель</Typography.Title><Radio.Group value={goal} onChange={(event) => setGoal(event.target.value)} className="goal-picker"><Radio.Button value="lose">Похудение<br /><small>Снижение процента жира</small></Radio.Button><Radio.Button value="gain">Набор мышечной массы</Radio.Button><Radio.Button value="recompose">Рекомпозиция<br /><small>Сжигаем жир, растим мышцы</small></Radio.Button></Radio.Group><Alert className="goal-explanation" type="info" showIcon title="Почему это важно" description="При одинаковом весе, но разном соотношении мышц и жира, базовая калорийность отличается: чем выше процент жира, тем меньше энергии обычно требуется. При высоком проценте жира набор мышечной массы или рекомпозиция чаще приводят к набору жира. При skinny fat — нормальном весе, небольшом количестве мышц и наличии жира — обычно лучше подходит рекомпозиция." /><Space><Button onClick={() => setStep(1)}>Назад</Button><Button type="primary" size="large" onClick={nextGoal}>Далее <RightOutlined /></Button></Space></section>}
    {step === 3 && <section><Typography.Title level={3}>Как вам удобнее вести питание?</Typography.Title><div className="mode-choice-grid"><Card className={mode === "dynamic" ? "selected-mode" : ""} onClick={() => selectMode("dynamic")}><Typography.Title level={4}>Структурный задрот</Typography.Title><Typography.Paragraph>Базовая калорийность без заранее заданной активности. Шаги, кардио и тренировки отмечаете в дневнике самостоятельно.</Typography.Paragraph><Button onClick={(event) => { event.stopPropagation(); setDetailsOpen("dynamic"); }}>Подробнее</Button>{mode === "dynamic" && <CheckCircleFilled />}</Card><Card className={mode === "fixed" ? "selected-mode" : ""} onClick={() => selectMode("fixed")}><Typography.Title level={4}>Конструктор меню</Typography.Title><Typography.Paragraph>Фиксированная цель на день и готовые варианты приёмов пищи, которые можно копировать в дневник.</Typography.Paragraph><Button onClick={(event) => { event.stopPropagation(); setDetailsOpen("fixed"); }}>Подробнее</Button>{mode === "fixed" && <CheckCircleFilled />}</Card></div>{mode === "fixed" && <Form form={planForm} layout="vertical" className="planning-form" initialValues={{ cardioIntensity: "medium", steps: 0, cardioMinutes: 0, trainingDays: 0 }} onFinish={(values) => void complete(values as PlanValues)}><Alert type="info" showIcon title="Как считается фиксированная активность" description="Шаги: шаги × 0,045 × (ваш вес ÷ 70). Кардио: минуты × (MET × 3,5 × вес) ÷ 200, затем недельный расход делится на 7." /><div className="onboarding-form-grid"><Form.Item name="steps" label="Среднее количество шагов за день" rules={[{ required: true, message: "Укажите средние шаги" }]}><InputNumber min={0} max={100000} className="full-width" /></Form.Item><Form.Item name="cardioMinutes" label="Кардио, минут за неделю" rules={[{ required: true, message: "Укажите минуты или 0" }]}><InputNumber min={0} max={5000} className="full-width" /></Form.Item><Form.Item name="cardioIntensity" label="Интенсивность кардио" rules={[{ required: true, message: "Выберите интенсивность" }]}><Segmented block options={[{ value: "low", label: "Лёгкая · 4 MET" }, { value: "medium", label: "Умеренная · 6 MET" }, { value: "high", label: "Интенсивная · 9 MET" }]} /></Form.Item><Form.Item name="experience" label="Уровень тренированности" rules={[{ required: true, message: "Выберите уровень" }]}><Radio.Group className="answer-list"><Radio.Button value="under_1_year">Меньше 1 года<br /><small>200 ккал / тренировка</small></Radio.Button><Radio.Button value="one_to_three_years">1–3 года<br /><small>250 ккал / тренировка</small></Radio.Button><Radio.Button value="over_3_years">Более 3 лет<br /><small>350 ккал / тренировка</small></Radio.Button></Radio.Group></Form.Item><Form.Item name="trainingDays" label="Полноценных тренировок в неделю" rules={[{ required: true, message: "Укажите число или 0" }]}><InputNumber min={0} max={7} className="full-width" /></Form.Item></div><Typography.Paragraph type="secondary">Уровень и количество тренировок сохраняются для вашего плана, но пока не прибавляются к общему расходу: текущая формула конструктора учитывает только шаги и кардио.</Typography.Paragraph><Space><Button onClick={() => setStep(2)}>Назад</Button><Button type="primary" htmlType="submit" size="large" loading={saving}>Завершить настройку</Button></Space></Form>}{mode === "dynamic" && <Space><Button onClick={() => setStep(2)}>Назад</Button><Button type="primary" size="large" loading={saving} onClick={() => void complete()}>Завершить настройку</Button></Space>}</section>}
    <ModalLike open={detailsOpen !== null} mode={detailsOpen} onClose={() => setDetailsOpen(null)} />
  </Card></section>;
}

function ModalLike({ open, mode, onClose }: { open: boolean; mode: DiaryMode | null; onClose: () => void }) {
  if (!open || !mode) return null;
  return <div className="mode-details" role="dialog" aria-modal="true"><Card><Button type="text" className="mode-details-close" onClick={onClose}>×</Button><Typography.Title level={3}>{mode === "dynamic" ? "Структурный задрот" : "Конструктор меню"}</Typography.Title><Typography.Paragraph>{mode === "dynamic" ? "Подходит тем, кому удобнее учитывать фактическую активность каждый день: базовая калорийность дополняется вашими шагами, кардио и тренировками в дневнике." : "Подходит тем, кому проще следовать фиксированной цели и использовать заранее сохранённые рецепты и готовые приёмы пищи."}</Typography.Paragraph><Typography.Text type="secondary">Соответствующий урок будет доступен в разделе обучения после подключения материалов.</Typography.Text><Button type="primary" block onClick={onClose}>Понятно</Button></Card></div>;
}