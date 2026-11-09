"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EditOutlined, FireOutlined, GoogleOutlined, LogoutOutlined, PlusOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, ConfigProvider, Divider, Form, Input, InputNumber, Modal, Progress, Radio, Select, Segmented, Space, Spin, Statistic, Tabs, Tag, Typography } from "antd";
import type { Session } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Meal = "Завтрак" | "Обед" | "Ужин" | "Перекус";
type DiaryMode = "fixed" | "dynamic";
type Intensity = "low" | "medium" | "high";
type Product = { id: string; name: string; brand?: string; calories: number; protein: number; fat: number; carbs: number };
type Entry = Product & { entryId: string; meal: Meal; servingGrams: number };
type MealTemplate = { id: string; name: string; meal: Meal; items: Array<Omit<Entry, "entryId" | "meal" | "id">> };
type Calculator = { sex?: "female" | "male"; age?: number; weight?: number; height?: number; bodyFatPercent?: number; activity?: number; goal?: "lose" | "maintain" | "gain"; diaryMode: DiaryMode };
type DailyActivity = { steps: number; cardioMinutes: number; cardioIntensity: Intensity; trainingMinutes: number; trainingIntensity: Intensity };
type ProductFormValues = { name: string; brand?: string; calories: string; protein: string; fat: string; carbs: string };

const mealToDb = { "Завтрак": "breakfast", "Обед": "lunch", "Ужин": "dinner", "Перекус": "snack" } as const;
const dbToMeal = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" } as const;
const emptyActivity: DailyActivity = { steps: 0, cardioMinutes: 0, cardioIntensity: "medium", trainingMinutes: 0, trainingIntensity: "medium" };
const intensityLabels = { low: "Низкая", medium: "Средняя", high: "Высокая" };

function isoDate(value: Date) { return value.toISOString().slice(0, 10); }
function numberOrZero(value: number | null) { return value ? Number(value) : 0; }
function parseDecimal(value: string | number | undefined) { const parsed = Number(String(value ?? "").trim().replace(/\s/g, "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : Number.NaN; }
function formatDecimal(value: number) { return String(value).replace(".", ","); }
function macroCalories(product: Pick<Product, "protein" | "fat" | "carbs">) { return product.protein * 4 + product.fat * 9 + product.carbs * 4; }
function validateProductNutrition(product: Omit<Product, "id">) { const values = [product.calories, product.protein, product.fat, product.carbs]; if (values.some((value) => !Number.isFinite(value) || value < 0)) return "Введите неотрицательные числа в полях КБЖУ."; if (product.protein > 100 || product.fat > 100 || product.carbs > 100 || product.protein + product.fat + product.carbs > 105) return "В 100 г продукта не может быть больше 100 г каждого БЖУ или больше 105 г БЖУ суммарно."; const calculated = macroCalories(product); const tolerance = Math.max(12, product.calories * 0.15); if (Math.abs(calculated - product.calories) > tolerance) return `КБЖУ дают ${Math.round(calculated)} ккал, а указано ${product.calories} ккал. Проверьте десятичный разделитель и значения Б/Ж/У.`; return null; }
function nutritionSchemaError(errorMessage: string) { return /body_fat_percent|nutrition_diary_mode|serving_grams|meal_templates|meal_template_items|schema cache|PGRST204/i.test(errorMessage) ? "База Supabase ещё не обновлена для этой функции. Выполните актуальные файлы из папки supabase/migrations в Supabase Dashboard → SQL Editor, затем обновите страницу." : null; }
function scaledProduct(product: Product, servingGrams: number): Product { const ratio = servingGrams / 100; return { ...product, calories: Math.round(product.calories * ratio), protein: Math.round(product.protein * ratio * 10) / 10, fat: Math.round(product.fat * ratio * 10) / 10, carbs: Math.round(product.carbs * ratio * 10) / 10 }; }
function intensityMet(kind: "cardio" | "training", intensity: Intensity) { return kind === "cardio" ? { low: 4, medium: 6, high: 8 }[intensity] : { low: 3.5, medium: 5, high: 6.5 }[intensity]; }
function caloriesFromMet(weight: number, minutes: number, met: number) { return Math.round((met * 3.5 * weight * minutes) / 200); }

function AuthCard({ onLogin }: { onLogin: () => void }) {
  const { message } = App.useApp(); const [loading, setLoading] = useState(false);
  async function passwordAuth(values: { email: string; password: string }, registration: boolean) { if (!isSupabaseConfigured) return message.error("Добавьте настройки Supabase в .env.local."); setLoading(true); const client = createClient(); const result = registration ? await client.auth.signUp({ ...values, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/nutrition` } }) : await client.auth.signInWithPassword(values); setLoading(false); if (result.error) return message.error(result.error.message); if (registration && !result.data.session) message.success("Проверьте почту и подтвердите регистрацию."); else onLogin(); }
  async function google() { if (!isSupabaseConfigured) return message.error("Добавьте настройки Supabase в .env.local."); const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/nutrition` } }); if (error) message.error(error.message); }
  const form = (registration: boolean) => <Form layout="vertical" onFinish={(values) => void passwordAuth(values, registration)}><Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Введите корректный email" }]}><Input size="large" autoComplete="email" /></Form.Item><Form.Item name="password" label="Пароль" rules={[{ required: true, min: 6, message: "Минимум 6 символов" }]}><Input.Password size="large" autoComplete={registration ? "new-password" : "current-password"} /></Form.Item><Button type="primary" size="large" block htmlType="submit" loading={loading}>{registration ? "Создать аккаунт" : "Войти"}</Button></Form>;
  return <Card className="auth-card"><Tabs items={[{ key: "login", label: "Войти", children: form(false) }, { key: "register", label: "Регистрация", children: form(true) }]} /><Divider plain>или</Divider><Button size="large" block icon={<GoogleOutlined />} onClick={() => void google()}>Продолжить с Google</Button></Card>;
}

function ProductEditor({ product, open, saving, onCancel, onSubmit }: { product: Product | null; open: boolean; saving: boolean; onCancel: () => void; onSubmit: (values: ProductFormValues) => void }) {
  const [form] = Form.useForm<ProductFormValues>();
  useEffect(() => { if (open) form.setFieldsValue(product ? { name: product.name, brand: product.brand, calories: formatDecimal(product.calories), protein: formatDecimal(product.protein), fat: formatDecimal(product.fat), carbs: formatDecimal(product.carbs) } : { name: "", brand: "", calories: "", protein: "", fat: "", carbs: "" }); }, [form, open, product]);
  return <Modal title={product ? "Исправить карточку продукта" : "Добавить продукт в базу"} open={open} footer={null} onCancel={onCancel} destroyOnHidden><Typography.Paragraph type="secondary">Все значения — на 100 г. Десятичные числа можно вводить через запятую: например, <b>17,5</b>.</Typography.Paragraph><Form form={form} layout="vertical" onFinish={onSubmit}><Form.Item name="name" label="Название" rules={[{ required: true, message: "Введите название" }]}><Input /></Form.Item><Form.Item name="brand" label="Бренд"><Input /></Form.Item><div className="product-form-grid"><Form.Item name="calories" label="Ккал / 100 г" rules={[{ required: true, message: "Введите калорийность" }]}><Input inputMode="decimal" placeholder="83" /></Form.Item><Form.Item name="protein" label="Белки, г" rules={[{ required: true, message: "Введите белки" }]}><Input inputMode="decimal" placeholder="2" /></Form.Item><Form.Item name="fat" label="Жиры, г" rules={[{ required: true, message: "Введите жиры" }]}><Input inputMode="decimal" placeholder="0,1" /></Form.Item><Form.Item name="carbs" label="Углеводы, г" rules={[{ required: true, message: "Введите углеводы" }]}><Input inputMode="decimal" placeholder="17,5" /></Form.Item></div><Space className="modal-actions"><Button onClick={onCancel}>Отмена</Button><Button type="primary" htmlType="submit" loading={saving}>{product ? "Сохранить изменения" : "Сохранить продукт"}</Button></Space></Form></Modal>;
}

function NutritionDashboardContent() {
  const { message } = App.useApp();
  const [session, setSession] = useState<Session | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [profileName, setProfileName] = useState(""); const [calculator, setCalculator] = useState<Calculator>({ diaryMode: "fixed" });
  const [selectedDate, setSelectedDate] = useState(() => new Date()); const [activity, setActivity] = useState<DailyActivity>(emptyActivity); const [entries, setEntries] = useState<Entry[]>([]); const [meal, setMeal] = useState<Meal>("Завтрак");
  const [query, setQuery] = useState(""); const [products, setProducts] = useState<Product[]>([]); const [searchLoading, setSearchLoading] = useState(false); const [portionProduct, setPortionProduct] = useState<Product | null>(null); const [portionGrams, setPortionGrams] = useState(100); const [editingProduct, setEditingProduct] = useState<Product | null | "new">(null); const [productSaving, setProductSaving] = useState(false);
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>([]); const [templateName, setTemplateName] = useState(""); const [templateModalOpen, setTemplateModalOpen] = useState(false); const [templateSaving, setTemplateSaving] = useState(false);
  const date = isoDate(selectedDate); const displayName = profileName || String(session?.user.user_metadata.full_name ?? session?.user.user_metadata.name ?? session?.user.email ?? "Пользователь");
  const calculation = useMemo(() => {
    if (!calculator.sex || !calculator.age || !calculator.weight || !calculator.height || !calculator.goal) return null;
    const leanMass = calculator.bodyFatPercent ? calculator.weight * (1 - calculator.bodyFatPercent / 100) : null;
    const bmr = Math.round(leanMass ? 370 + 21.6 * leanMass : 10 * calculator.weight + 6.25 * calculator.height - 5 * calculator.age + (calculator.sex === "male" ? 5 : -161));
    const goalAdjustment = calculator.goal === "lose" ? -400 : calculator.goal === "gain" ? 300 : 0;
    const stepCalories = Math.round(activity.steps * calculator.weight * 0.0005);
    const cardioCalories = caloriesFromMet(calculator.weight, activity.cardioMinutes, intensityMet("cardio", activity.cardioIntensity));
    const trainingCalories = caloriesFromMet(calculator.weight, activity.trainingMinutes, intensityMet("training", activity.trainingIntensity));
    const activityCalories = stepCalories + cardioCalories + trainingCalories;
    const calories = calculator.diaryMode === "dynamic" ? Math.max(1200, bmr + activityCalories + goalAdjustment) : Math.max(1200, Math.round(bmr * (calculator.activity ?? 1.2) + goalAdjustment));
    const protein = Math.round(calculator.weight * 1.7); const fat = Math.round(calculator.weight * 0.9);
    return { bmr, goalAdjustment, stepCalories, cardioCalories, trainingCalories, activityCalories, calories, protein, fat, carbs: Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4)) };
  }, [calculator, activity]);
  const eaten = useMemo(() => entries.reduce((sum, entry) => sum + entry.calories, 0), [entries]);
  const consumed = useMemo(() => ({ protein: entries.reduce((sum, entry) => sum + entry.protein, 0), fat: entries.reduce((sum, entry) => sum + entry.fat, 0), carbs: entries.reduce((sum, entry) => sum + entry.carbs, 0) }), [entries]);

  async function loadDay(nextDate = date, currentSession = session) {
    if (!currentSession || !isSupabaseConfigured) return;
    const client = createClient(); const [{ data: profile }, { data: dayActivity }, { data, error }] = await Promise.all([
      client.from("profiles").select("display_name, sex, age, weight, height, body_fat_percent, activity, goal, nutrition_diary_mode").eq("id", currentSession.user.id).maybeSingle(),
      client.from("nutrition_daily_activities").select("steps, cardio_minutes, cardio_intensity, training_minutes, training_intensity").eq("user_id", currentSession.user.id).eq("activity_date", nextDate).maybeSingle(),
      client.from("diary_entries").select("id, meal_type, name, calories, protein, fat, carbs, serving_grams").eq("user_id", currentSession.user.id).eq("entry_date", nextDate).order("created_at")
    ]);
    if (error) return message.error(`Не удалось загрузить дневник: ${error.message}`);
    setProfileName(profile?.display_name ?? ""); setCalculator({ sex: profile?.sex ?? undefined, age: profile?.age ?? undefined, weight: profile?.weight ? Number(profile.weight) : undefined, height: profile?.height ?? undefined, bodyFatPercent: profile?.body_fat_percent ? Number(profile.body_fat_percent) : undefined, activity: profile?.activity ? Number(profile.activity) : undefined, goal: profile?.goal ?? undefined, diaryMode: profile?.nutrition_diary_mode === "dynamic" ? "dynamic" : "fixed" });
    setActivity(dayActivity ? { steps: Number(dayActivity.steps), cardioMinutes: Number(dayActivity.cardio_minutes), cardioIntensity: dayActivity.cardio_intensity as Intensity, trainingMinutes: Number(dayActivity.training_minutes), trainingIntensity: dayActivity.training_intensity as Intensity } : emptyActivity);
    setEntries((data ?? []).map((entry) => ({ entryId: entry.id, id: entry.id, name: entry.name, calories: Number(entry.calories), protein: Number(entry.protein), fat: Number(entry.fat), carbs: Number(entry.carbs), servingGrams: Number(entry.serving_grams ?? 100), meal: dbToMeal[entry.meal_type as keyof typeof dbToMeal] ?? "Перекус" })));
  }
  async function loadTemplates(currentSession = session) {
    if (!currentSession || !isSupabaseConfigured) return;
    const { data, error } = await createClient().from("meal_templates").select("id, name, meal_type, meal_template_items(name, serving_grams, calories, protein, fat, carbs)").eq("user_id", currentSession.user.id).order("created_at", { ascending: false });
    if (error) return message.error(nutritionSchemaError(error.message) ?? `Не удалось загрузить шаблоны: ${error.message}`);
    setMealTemplates((data ?? []).map((template) => ({ id: template.id, name: template.name, meal: dbToMeal[template.meal_type as keyof typeof dbToMeal] ?? "Перекус", items: (template.meal_template_items ?? []).map((item) => ({ name: item.name, servingGrams: Number(item.serving_grams), calories: Number(item.calories), protein: Number(item.protein), fat: Number(item.fat), carbs: Number(item.carbs) })) })));
  }
  useEffect(() => { if (!isSupabaseConfigured) { setLoading(false); return; } const client = createClient(); client.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); }); const { data: listener } = client.auth.onAuthStateChange((_event, next) => setSession(next)); return () => listener.subscription.unsubscribe(); }, []);
  useEffect(() => { if (!session) return; void loadDay(); void loadTemplates(); }, [session, date]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const value = query.trim(); if (value.length < 2) { setProducts([]); return; } const timer = window.setTimeout(() => void searchProducts(value), 450); return () => window.clearTimeout(timer); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSettings() { if (!session || !calculation || !calculator.activity) return message.error("Заполните пол, возраст, вес, рост, цель и среднюю активность."); setSaving(true); const { error } = await createClient().from("profiles").upsert({ id: session.user.id, sex: calculator.sex, age: calculator.age, weight: calculator.weight, height: calculator.height, body_fat_percent: calculator.bodyFatPercent || null, activity: calculator.activity, goal: calculator.goal, nutrition_diary_mode: calculator.diaryMode }, { onConflict: "id" }); setSaving(false); if (error) return message.error(nutritionSchemaError(error.message) ?? `Не удалось сохранить настройки: ${error.message}`, 8); message.success("Настройки питания сохранены"); }
  async function saveActivity() { if (!session) return; setSaving(true); const { error } = await createClient().from("nutrition_daily_activities").upsert({ user_id: session.user.id, activity_date: date, steps: activity.steps, cardio_minutes: activity.cardioMinutes, cardio_intensity: activity.cardioIntensity, training_minutes: activity.trainingMinutes, training_intensity: activity.trainingIntensity, updated_at: new Date().toISOString() }, { onConflict: "user_id,activity_date" }); setSaving(false); if (error) return message.error(`Не удалось сохранить активность: ${error.message}`); message.success("Активность за день сохранена"); }
  async function searchProducts(value: string) { setSearchLoading(true); try { let found: Product[] = []; if (session) { const { data, error } = await createClient().from("products").select("id, name, brand, calories, protein, fat, carbs").ilike("name", `%${value}%`).limit(12); if (error) throw error; found = (data ?? []).map((item) => ({ ...item, calories: Number(item.calories), protein: Number(item.protein), fat: Number(item.fat), carbs: Number(item.carbs) })); } if (!found.length) { const response = await fetch(`/api/products?${new URLSearchParams({ q: value })}`); const data = await response.json() as { products?: Product[]; error?: string }; if (!response.ok) throw new Error(data.error); found = data.products ?? []; } setProducts(found); } catch (error) { message.error(error instanceof Error ? error.message : "Не удалось найти продукт."); } finally { setSearchLoading(false); } }
  async function saveProduct(values: ProductFormValues) { if (!session) return; const product = { name: values.name.trim(), brand: values.brand?.trim() || undefined, calories: parseDecimal(values.calories), protein: parseDecimal(values.protein), fat: parseDecimal(values.fat), carbs: parseDecimal(values.carbs) }; const validationMessage = validateProductNutrition(product); if (validationMessage) return message.error(validationMessage); setProductSaving(true); const result = editingProduct === "new" ? await createClient().from("products").insert({ ...product, owner_id: session.user.id, is_public: true }).select("id, name, brand, calories, protein, fat, carbs").single() : await createClient().from("products").update(product).eq("id", editingProduct?.id).select("id, name, brand, calories, protein, fat, carbs").single(); setProductSaving(false); if (result.error) return message.error(`Не удалось сохранить карточку: ${result.error.message}`); const saved: Product = { ...result.data, calories: Number(result.data.calories), protein: Number(result.data.protein), fat: Number(result.data.fat), carbs: Number(result.data.carbs) }; setProducts((current) => editingProduct === "new" ? [saved, ...current] : current.map((item) => item.id === saved.id ? saved : item)); setEditingProduct(null); message.success(editingProduct === "new" ? "Продукт добавлен в общую базу" : "Карточка продукта исправлена"); }
  async function addPortion() { if (!session || !portionProduct || !portionGrams) return; const product = scaledProduct(portionProduct, portionGrams); const { data, error } = await createClient().from("diary_entries").insert({ user_id: session.user.id, meal_type: mealToDb[meal], entry_date: date, name: product.name, serving_grams: portionGrams, calories: product.calories, protein: product.protein, fat: product.fat, carbs: product.carbs }).select("id").single(); if (error) { if (error.message.includes("serving_grams")) return message.error("В базе не включено сохранение граммовки. Выполните миграцию 20261109_nutrition_diary_modes.sql в Supabase SQL Editor и повторите попытку.", 8); return message.error(`Не удалось добавить продукт: ${error.message}`); } setEntries((current) => [...current, { ...product, entryId: data.id, meal, servingGrams: portionGrams }]); setPortionProduct(null); setQuery(""); setProducts([]); message.success(`${product.name} добавлен в дневник`); }
  async function removeEntry(entryId: string) { const { error } = await createClient().from("diary_entries").delete().eq("id", entryId); if (error) return message.error(`Не удалось удалить запись: ${error.message}`); setEntries((current) => current.filter((entry) => entry.entryId !== entryId)); }
  async function saveMealTemplate() { if (!session) return; const name = templateName.trim(); const templateEntries = entries.filter((entry) => entry.meal === meal); if (name.length < 2) return message.error("Введите название шаблона из двух или более символов."); if (!templateEntries.length) return message.error(`Добавьте хотя бы один продукт в «${meal}», прежде чем сохранять шаблон.`); setTemplateSaving(true); const client = createClient(); const { data: template, error } = await client.from("meal_templates").insert({ user_id: session.user.id, name, meal_type: mealToDb[meal] }).select("id").single(); if (error || !template) { setTemplateSaving(false); return message.error(nutritionSchemaError(error?.message ?? "") ?? `Не удалось сохранить шаблон: ${error?.message ?? "нет ответа"}`); } const { error: itemsError } = await client.from("meal_template_items").insert(templateEntries.map((entry) => ({ template_id: template.id, name: entry.name, serving_grams: entry.servingGrams, calories: entry.calories, protein: entry.protein, fat: entry.fat, carbs: entry.carbs }))); setTemplateSaving(false); if (itemsError) return message.error(nutritionSchemaError(itemsError.message) ?? `Не удалось сохранить позиции шаблона: ${itemsError.message}`); setTemplateModalOpen(false); setTemplateName(""); await loadTemplates(); message.success("Шаблон приёма пищи сохранён"); }
  async function addTemplateToDiary(template: MealTemplate) { if (!session || !template.items.length) return; setTemplateSaving(true); const { data, error } = await createClient().from("diary_entries").insert(template.items.map((item) => ({ user_id: session.user.id, meal_type: mealToDb[meal], entry_date: date, name: item.name, serving_grams: item.servingGrams, calories: item.calories, protein: item.protein, fat: item.fat, carbs: item.carbs }))).select("id, name, serving_grams, calories, protein, fat, carbs"); setTemplateSaving(false); if (error) return message.error(nutritionSchemaError(error.message) ?? `Не удалось вставить шаблон: ${error.message}`); setEntries((current) => [...current, ...(data ?? []).map((item) => ({ entryId: item.id, id: item.id, name: item.name, servingGrams: Number(item.serving_grams), calories: Number(item.calories), protein: Number(item.protein), fat: Number(item.fat), carbs: Number(item.carbs), meal }))]); message.success(`«${template.name}» добавлен в «${meal}»`); }
  async function deleteMealTemplate(templateId: string) { const { error } = await createClient().from("meal_templates").delete().eq("id", templateId); if (error) return message.error(`Не удалось удалить шаблон: ${error.message}`); setMealTemplates((current) => current.filter((template) => template.id !== templateId)); message.success("Шаблон удалён"); }
  async function signOut() { await createClient().auth.signOut(); setSession(null); }

  if (loading) return <main className="app-shell loading-screen"><Spin size="large" /></main>;
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><FireOutlined /></span>myFitnea</div>
        {session && <Space wrap>
          <Space.Compact className="section-nav"><Link href="/"><Button>Тренировки</Button></Link><Button type="primary">Питание</Button></Space.Compact>
          <Tag icon={<UserOutlined />} color="green">{displayName}</Tag>
          <Button icon={<LogoutOutlined />} onClick={() => void signOut()}>Выйти</Button>
        </Space>}
      </header>

      {!session ? <>
        <AuthCard onLogin={() => undefined} />
        {!isSupabaseConfigured && <Alert type="warning" title="Добавьте настройки Supabase в .env.local" />}
      </> : <>
        <section className="nutrition-hero">
          <div><Typography.Text className="eyebrow">ДНЕВНИК ПИТАНИЯ</Typography.Text><Typography.Title>{calculator.diaryMode === "dynamic" ? "Гибкая цель на каждый день" : "Стабильный план на каждый день"}</Typography.Title><Typography.Paragraph>{calculator.diaryMode === "dynamic" ? "Цель меняется по шагам, кардио и тренировкам." : "Калорийность учитывает привычную активность и остаётся одинаковой каждый день."}</Typography.Paragraph></div>
          <div className="calorie-orb"><FireOutlined /><strong>{calculation?.calories ?? "—"}</strong><span>ккал на день</span></div>
        </section>

        <section className="nutrition-date-row">
          <input className="native-input nutrition-date-input" type="date" value={date} onChange={(event) => setSelectedDate(new Date(`${event.target.value}T12:00:00`))} />
          <Typography.Text type="secondary">{date === isoDate(new Date()) ? "Сегодня" : `Дневник за ${selectedDate.toLocaleDateString("ru-RU")}`}</Typography.Text>
        </section>

        <section className="nutrition-grid">
          <Card title="Настройки питания" className="panel">
            <Radio.Group value={calculator.diaryMode} onChange={(event) => setCalculator({ ...calculator, diaryMode: event.target.value as DiaryMode })} className="diary-mode-picker">
              <Radio.Button value="fixed"><strong>Конструктор меню</strong><span>Фиксированная цель и готовые приёмы пищи</span></Radio.Button>
              <Radio.Button value="dynamic"><strong>Структурный задрот</strong><span>База + ваш фактический расход</span></Radio.Button>
            </Radio.Group>
            <div className="calculator-grid">
              <label>Пол<Select value={calculator.sex} onChange={(sex) => setCalculator({ ...calculator, sex: sex as Calculator["sex"] })} options={[{ value: "female", label: "Женский" }, { value: "male", label: "Мужской" }]} /></label>
              <label>Возраст<InputNumber min={14} max={100} value={calculator.age} onChange={(value) => setCalculator({ ...calculator, age: numberOrZero(value) || undefined })} /></label>
              <label>Вес, кг<InputNumber min={35} max={250} value={calculator.weight} onChange={(value) => setCalculator({ ...calculator, weight: numberOrZero(value) || undefined })} /></label>
              <label>Рост, см<InputNumber min={120} max={230} value={calculator.height} onChange={(value) => setCalculator({ ...calculator, height: numberOrZero(value) || undefined })} /></label>
              <label>Процент жира, % <Typography.Text type="secondary">(необязательно)</Typography.Text><InputNumber min={3} max={70} value={calculator.bodyFatPercent} onChange={(value) => setCalculator({ ...calculator, bodyFatPercent: numberOrZero(value) || undefined })} /></label>
              <label>Средняя активность<Select value={calculator.activity} onChange={(activity) => setCalculator({ ...calculator, activity: Number(activity) })} options={[{ value: 1.2, label: "Минимальная" }, { value: 1.375, label: "Лёгкая: 1–3 тренировки" }, { value: 1.55, label: "Средняя: 3–5 тренировок" }, { value: 1.725, label: "Высокая: 6–7 тренировок" }]} /></label>
              <label>Цель<Select value={calculator.goal} onChange={(goal) => setCalculator({ ...calculator, goal: goal as Calculator["goal"] })} options={[{ value: "lose", label: "Снижение веса" }, { value: "maintain", label: "Поддержание" }, { value: "gain", label: "Набор массы" }]} /></label>
            </div>
            <Button type="primary" onClick={() => void saveSettings()} loading={saving}>Сохранить настройки</Button>
          </Card>

          <Card title={calculator.diaryMode === "dynamic" ? "Фактическая активность за день" : "Ваше меню на каждый день"} className="panel">
            {calculator.diaryMode === "dynamic" ? <>
              <Typography.Paragraph type="secondary">База рассчитывается по весу, росту, возрасту, полу и проценту жира. Шаги, кардио и тренировки вы добавляете вручную — дневная цель растёт вместе с расходом.</Typography.Paragraph>
              <div className="activity-form">
                <label>Шаги<InputNumber min={0} max={100000} value={activity.steps} onChange={(value) => setActivity({ ...activity, steps: numberOrZero(value) })} /></label>
                <label>Кардио, минут<InputNumber min={0} max={600} value={activity.cardioMinutes} onChange={(value) => setActivity({ ...activity, cardioMinutes: numberOrZero(value) })} /></label>
                <label>Интенсивность кардио<Segmented value={activity.cardioIntensity} onChange={(value) => setActivity({ ...activity, cardioIntensity: value as Intensity })} options={Object.entries(intensityLabels).map(([value, label]) => ({ value, label }))} /></label>
                <label>Тренировка, минут<InputNumber min={0} max={600} value={activity.trainingMinutes} onChange={(value) => setActivity({ ...activity, trainingMinutes: numberOrZero(value) })} /></label>
                <label>Интенсивность тренировки<Segmented value={activity.trainingIntensity} onChange={(value) => setActivity({ ...activity, trainingIntensity: value as Intensity })} options={Object.entries(intensityLabels).map(([value, label]) => ({ value, label }))} /></label>
              </div>
              <Button type="primary" onClick={() => void saveActivity()} loading={saving}>Сохранить активность</Button><Divider />
              <div className="activity-summary"><Statistic title="Шаги" value={calculation?.stepCalories ?? 0} suffix="ккал" /><Statistic title="Кардио" value={calculation?.cardioCalories ?? 0} suffix="ккал" /><Statistic title="Тренировка" value={calculation?.trainingCalories ?? 0} suffix="ккал" /></div>
            </> : <><Statistic title="Фиксированная дневная цель" value={calculation?.calories ?? 0} suffix="ккал" /><Typography.Paragraph type="secondary">Базовый обмен {calculation?.bmr ?? "—"} ккал × средний уровень активности. Используйте шаблоны ниже, чтобы быстро собрать рацион.</Typography.Paragraph></>}
          </Card>
        </section>

        {calculation && <section className="daily-summary">
          <Card><Statistic title="Цель" value={calculation.calories} suffix="ккал" /></Card><Card><Statistic title="Съедено" value={eaten} suffix="ккал" /></Card><Card><Statistic title={calculation.calories >= eaten ? "Осталось" : "Превышение"} value={Math.abs(calculation.calories - eaten)} suffix="ккал" /></Card>
          <Card><div className="macro-summary"><strong>Б {Math.round(consumed.protein)}/{calculation.protein} г</strong><strong>Ж {Math.round(consumed.fat)}/{calculation.fat} г</strong><strong>У {Math.round(consumed.carbs)}/{calculation.carbs} г</strong></div><Progress percent={Math.min(100, Math.round(eaten / calculation.calories * 100))} showInfo={false} strokeColor="#237a58" /></Card>
        </section>}

        <section className="food-panel">
          <div className="food-heading"><div><Typography.Title level={2}>Рацион</Typography.Title><Typography.Text type="secondary">Значения продуктов на 100 г — перед добавлением выберите порцию.</Typography.Text></div><Segmented value={meal} onChange={(value) => setMeal(value as Meal)} options={["Завтрак", "Обед", "Ужин", "Перекус"]} /></div>
          {calculator.diaryMode === "fixed" && <div className="template-panel"><div><Typography.Title level={4}>Шаблоны приёмов пищи</Typography.Title><Typography.Text type="secondary">Сохраните текущий «{meal}» как готовое блюдо или вставьте ранее сохранённый вариант в дневник.</Typography.Text></div><Button onClick={() => setTemplateModalOpen(true)} disabled={!entries.some((entry) => entry.meal === meal)}>Сохранить текущий приём</Button><div className="template-list">{mealTemplates.length ? mealTemplates.map((template) => <Card key={template.id} size="small" className="template-card"><div><strong>{template.name}</strong><Typography.Text type="secondary">{template.meal} · {template.items.length} поз. · {Math.round(template.items.reduce((sum, item) => sum + item.calories, 0))} ккал</Typography.Text></div><Space><Button type="primary" size="small" loading={templateSaving} onClick={() => void addTemplateToDiary(template)}>Вставить в «{meal}»</Button><Button danger type="text" size="small" onClick={() => void deleteMealTemplate(template.id)}>Удалить</Button></Space></Card>) : <Typography.Text type="secondary">Пока нет сохранённых приёмов пищи.</Typography.Text>}</div></div>}
          <div className="product-search-row"><Input.Search value={query} onChange={(event) => setQuery(event.target.value)} loading={searchLoading} placeholder="Найти продукт" size="large" /><Button icon={<PlusOutlined />} onClick={() => setEditingProduct("new")}>Добавить продукт</Button></div>
          <div className="product-list">{products.map((product) => <div className="product-item" key={product.id}><button className="product-add-button" onClick={() => { setPortionProduct(product); setPortionGrams(100); }}><span><strong>{product.name}</strong><small>{product.brand ? `${product.brand} · ` : ""}Б {product.protein} · Ж {product.fat} · У {product.carbs}</small></span><span><b>{product.calories}</b><small>ккал / 100 г</small></span><PlusOutlined /></button><Button className="product-edit-button" type="text" icon={<EditOutlined />} onClick={() => setEditingProduct(product)}>Исправить</Button></div>)}</div>
          <div className="meal-entry-grid">{(["Завтрак", "Обед", "Ужин", "Перекус"] as Meal[]).map((mealName) => <Card key={mealName} size="small" title={mealName}>{entries.filter((entry) => entry.meal === mealName).length ? entries.filter((entry) => entry.meal === mealName).map((entry) => <div className="diary-entry" key={entry.entryId}><span><strong>{entry.name}</strong><small>{entry.servingGrams} г · Б {entry.protein} · Ж {entry.fat} · У {entry.carbs}</small></span><span><b>{entry.calories} ккал</b><Button type="text" danger size="small" onClick={() => void removeEntry(entry.entryId)}>Удалить</Button></span></div>) : <Typography.Text type="secondary">Пока пусто</Typography.Text>}</Card>)}</div>
        </section>

        <Modal title={`Добавить в «${meal}»`} open={Boolean(portionProduct)} onCancel={() => setPortionProduct(null)} onOk={() => void addPortion()} okText="Добавить" cancelText="Отмена">
          <Typography.Title level={4}>{portionProduct?.name}</Typography.Title><Typography.Paragraph type="secondary">КБЖУ будут пересчитаны из значений на 100 г.</Typography.Paragraph><Space.Compact block><InputNumber min={1} max={5000} value={portionGrams} onChange={(value) => setPortionGrams(numberOrZero(value) || 1)} className="full-width" /><Button disabled>г</Button></Space.Compact>
          {portionProduct && <><Divider /><Statistic title="В порции" value={scaledProduct(portionProduct, portionGrams).calories} suffix="ккал" /></>}
        </Modal>
        <Modal title={`Сохранить «${meal}» как шаблон`} open={templateModalOpen} onCancel={() => setTemplateModalOpen(false)} onOk={() => void saveMealTemplate()} okText="Сохранить шаблон" confirmLoading={templateSaving} cancelText="Отмена">
          <Typography.Paragraph type="secondary">В шаблон попадут все продукты из текущего «{meal}». Позже его можно вставить в любой приём пищи и дополнить отдельными продуктами.</Typography.Paragraph>
          <Input autoFocus value={templateName} maxLength={100} onChange={(event) => setTemplateName(event.target.value)} placeholder="Например, овсянка с ягодами" />
        </Modal>
        <ProductEditor product={editingProduct === "new" ? null : editingProduct} open={editingProduct !== null} saving={productSaving} onCancel={() => setEditingProduct(null)} onSubmit={(values) => void saveProduct(values)} />
      </>}
    </main>
  );
}

export default function NutritionDashboard() { return <ConfigProvider theme={{ token: { colorPrimary: "#237a58", borderRadius: 14, fontFamily: "Arial, sans-serif" } }}><App><NutritionDashboardContent /></App></ConfigProvider>; }