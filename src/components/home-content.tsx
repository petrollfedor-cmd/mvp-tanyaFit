"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CameraOutlined, DeleteOutlined, FireOutlined, GoogleOutlined, LogoutOutlined, PlusOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, ConfigProvider, Divider, Form, Input, InputNumber, Modal, Progress, Segmented, Select, Space, Statistic, Tabs, Tag, Typography, Upload } from "antd";
import type { UploadFile } from "antd";
import type { Session } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Meal = "Завтрак" | "Обед" | "Ужин" | "Перекус";
type Product = { id: string; barcode?: string; name: string; brand?: string; description?: string; imageUrl?: string; calories: number; protein: number; fat: number; carbs: number };
type ProductFormValues = Omit<Product, "id" | "imageUrl">;
type DiaryEntry = Product & { entryId: string; meal: Meal };
type Calculator = { sex?: "female" | "male"; age?: number; weight?: number; height?: number; activity?: number; goal?: "lose" | "maintain" | "gain" };
type BarcodeDetectorInstance = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;
const mealToDb = { "Завтрак": "breakfast", "Обед": "lunch", "Ужин": "dinner", "Перекус": "snack" } as const;
const dbToMeal = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" } as const;

function AuthForm({ submitText, loading, onSubmit }: { submitText: string; loading: boolean; onSubmit: (values: { email: string; password: string }) => void }) {
  return <Form layout="vertical" onFinish={onSubmit}><Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Введите корректный email" }]}><Input size="large" placeholder="name@email.com" autoComplete="email" /></Form.Item><Form.Item name="password" label="Пароль" rules={[{ required: true, min: 6, message: "Минимум 6 символов" }]}><Input.Password size="large" placeholder="Минимум 6 символов" autoComplete="current-password" /></Form.Item><Button type="primary" size="large" block htmlType="submit" loading={loading}>{submitText}</Button></Form>;
}

function HomeContent() {
  const { message } = App.useApp();
  const [session, setSession] = useState<Session | null>(null);
  const [profileName, setProfileName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [meal, setMeal] = useState<Meal>("Завтрак");
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [missingBarcode, setMissingBarcode] = useState("");
  const [productPhotos, setProductPhotos] = useState<UploadFile[]>([]);
  const [productSaving, setProductSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const [calculator, setCalculator] = useState<Calculator>({});
  const target = useMemo(() => {
    if (!calculator.sex || !calculator.age || !calculator.weight || !calculator.height || !calculator.activity || !calculator.goal) return null;
    const base = calculator.sex === "male" ? 10 * calculator.weight + 6.25 * calculator.height - 5 * calculator.age + 5 : 10 * calculator.weight + 6.25 * calculator.height - 5 * calculator.age - 161;
    const adjustment = calculator.goal === "lose" ? -400 : calculator.goal === "gain" ? 300 : 0;
    const calories = Math.max(1200, Math.round(base * calculator.activity + adjustment));
    return { calories, protein: Math.round(calculator.weight * 1.7), fat: Math.round(calculator.weight * 0.9), carbs: Math.round((calories - calculator.weight * 1.7 * 4 - calculator.weight * 0.9 * 9) / 4) };
  }, [calculator]);
  const eaten = useMemo(() => entries.reduce((total, item) => total + item.calories, 0), [entries]);
  const displayName = profileName || String(session?.user.user_metadata.full_name ?? session?.user.user_metadata.name ?? session?.user.email ?? "Пользователь");
  function stopScanner() { if (scanTimerRef.current) window.clearInterval(scanTimerRef.current); scanTimerRef.current = null; scannerControlsRef.current?.stop(); scannerControlsRef.current = null; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setScannerOpen(false); }
  async function searchProducts(query = search, code = "") {
    const value = code || query.trim();
    if ((!code && value.length < 2) || !value) { setProducts([]); setMissingBarcode(""); return; }
    setSearchLoading(true); setMissingBarcode("");
    try {
      let catalogProducts: Product[] = [];
      if (session && isSupabaseConfigured) {
        const request = createClient().from("products").select("id, barcode, name, brand, description, image_urls, calories, protein, fat, carbs");
        const { data, error } = code ? await request.eq("barcode", code).limit(12) : await request.ilike("name", `%${value}%`).limit(12);
        if (error) throw error;
        catalogProducts = (data ?? []).map((product) => ({ ...product, imageUrl: product.image_urls?.[0], calories: Number(product.calories), protein: Number(product.protein), fat: Number(product.fat), carbs: Number(product.carbs) }));
      }
      if (catalogProducts.length) { setProducts(catalogProducts); return; }
      const response = await fetch(`/api/products?${new URLSearchParams(code ? { barcode: code } : { q: value })}`);
      const data = await response.json() as { products?: Product[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Ошибка поиска.");
      const found = data.products ?? [];
      setProducts(found);
      if (code && !found.length) setMissingBarcode(code);
    } catch (error) { message.error(error instanceof Error ? error.message : "Не удалось найти продукт."); } finally { setSearchLoading(false); }
  }
  async function openScanner() {
    const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!navigator.mediaDevices?.getUserMedia) return message.info("Ваш браузер не даёт доступ к камере. Введите штрихкод вручную.");
    setScannerMessage("");
    setScannerOpen(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      if (!videoRef.current) throw new Error("Видео не инициализировано.");
      if (Detector) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        scanTimerRef.current = window.setInterval(async () => { if (!videoRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return; const codes = await detector.detect(videoRef.current).catch(() => []); const found = codes[0]?.rawValue?.replace(/\D/g, ""); if (found) { setBarcode(found); stopScanner(); void searchProducts("", found); } }, 400);
        return;
      }
      setScannerMessage("Наведите камеру на штрихкод: весь код должен быть в кадре, без бликов, на расстоянии 10–20 см.");
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      const hints = new Map<import("@zxing/library").DecodeHintType, unknown>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 500 });
      scannerControlsRef.current = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, videoRef.current, (result) => { const found = result?.getText().replace(/\D/g, ""); if (found) { setBarcode(found); stopScanner(); void searchProducts("", found); } });
    } catch { stopScanner(); setScannerMessage("Не удалось открыть камеру. Разрешите доступ к камере и попробуйте ещё раз, либо введите штрихкод вручную."); }
  }
  useEffect(() => () => stopScanner(), []);
  useEffect(() => { if (!isSupabaseConfigured) return; const supabase = createClient(); supabase.auth.getSession().then(({ data }) => setSession(data.session)); const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession)); if (new URLSearchParams(window.location.search).get("login") === "success") { message.success("Вы вошли в аккаунт"); window.history.replaceState({}, "", "/"); } return () => listener.subscription.unsubscribe(); }, [message]);
  useEffect(() => {
    if (!session || !isSupabaseConfigured) return;
    const supabase = createClient(); void (async () => { const fallbackName = String(session.user.user_metadata.full_name ?? session.user.user_metadata.name ?? ""); await supabase.from("profiles").upsert({ id: session.user.id, display_name: fallbackName || null }, { onConflict: "id", ignoreDuplicates: true }); const [{ data: profile }, { data, error }] = await Promise.all([supabase.from("profiles").select("display_name, sex, age, weight, height, activity, goal").eq("id", session.user.id).maybeSingle(), supabase.from("diary_entries").select("id, meal_type, name, calories, protein, fat, carbs").eq("user_id", session.user.id).eq("entry_date", new Date().toISOString().slice(0, 10)).order("created_at")]); setProfileName(profile?.display_name ?? fallbackName); if (profile) setCalculator({ sex: profile.sex ?? undefined, age: profile.age ?? undefined, weight: profile.weight ? Number(profile.weight) : undefined, height: profile.height ?? undefined, activity: profile.activity ? Number(profile.activity) : undefined, goal: profile.goal ?? undefined }); if (error) return message.error(`Не удалось загрузить дневник: ${error.message}`); setEntries((data ?? []).map((entry) => ({ entryId: entry.id, id: entry.id, name: entry.name, calories: Number(entry.calories), protein: Number(entry.protein), fat: Number(entry.fat), carbs: Number(entry.carbs), meal: dbToMeal[entry.meal_type as keyof typeof dbToMeal] ?? "Перекус" }))); })();
  }, [session, message]);
  useEffect(() => { const query = search.trim(); if (query.length < 2) return; const timer = window.setTimeout(() => void searchProducts(query), 500); return () => window.clearTimeout(timer); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  async function login(values: { email: string; password: string }) { if (!isSupabaseConfigured) return message.error("Добавьте переменные Supabase в .env.local."); setAuthLoading(true); const { error } = await createClient().auth.signInWithPassword(values); setAuthLoading(false); if (error) return message.error(error.message); message.success("Вы вошли в аккаунт"); }
  async function register(values: { email: string; password: string }) { if (!isSupabaseConfigured) return message.error("Добавьте переменные Supabase в .env.local."); setAuthLoading(true); const { data, error } = await createClient().auth.signUp({ ...values, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` } }); setAuthLoading(false); if (error) return message.error(error.message); message.success(data.session ? "Вы вошли в аккаунт" : "Проверьте почту и подтвердите регистрацию."); }
  async function signInWithGoogle() { if (!isSupabaseConfigured) return message.error("Добавьте переменные Supabase в .env.local."); const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } }); if (error) message.error(error.message); }
  async function signOut() { await createClient().auth.signOut(); message.success("Вы вышли из аккаунта"); }
  async function addProduct(product: Product) { const localEntry: DiaryEntry = { ...product, entryId: crypto.randomUUID(), meal }; if (session && isSupabaseConfigured) { const { data, error } = await createClient().from("diary_entries").insert({ user_id: session.user.id, meal_type: mealToDb[meal], name: product.name, calories: product.calories, protein: product.protein, fat: product.fat, carbs: product.carbs }).select("id").single(); if (error) return message.error(`Не удалось добавить в дневник: ${error.message}`); localEntry.entryId = data.id; } setEntries((current) => [...current, localEntry]); message.success(`${product.name} добавлен в «${meal}»`); }
  async function removeEntry(entry: DiaryEntry) { if (session && isSupabaseConfigured) { const { error } = await createClient().from("diary_entries").delete().eq("id", entry.entryId); if (error) return message.error(`Не удалось удалить запись: ${error.message}`); } setEntries((current) => current.filter((item) => item.entryId !== entry.entryId)); }
  async function createProduct(values: ProductFormValues) {
    if (!session || !isSupabaseConfigured) return message.error("Войдите в аккаунт, чтобы добавить товар в общую базу.");
    if (!productPhotos.length) return message.error("Добавьте хотя бы одну фотографию товара.");
    setProductSaving(true);
    try {
      const supabase = createClient(); const imageUrls: string[] = [];
      for (const photo of productPhotos) {
        if (!photo.originFileObj) continue;
        const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("product-photos").upload(path, photo.originFileObj, { contentType: photo.originFileObj.type });
        if (error) throw error;
        imageUrls.push(supabase.storage.from("product-photos").getPublicUrl(path).data.publicUrl);
      }
      const { data, error } = await supabase.from("products").insert({ owner_id: session.user.id, is_public: true, barcode: values.barcode || null, name: values.name.trim(), brand: values.brand?.trim() || null, description: values.description?.trim() || null, image_urls: imageUrls, calories: values.calories, protein: values.protein, fat: values.fat, carbs: values.carbs }).select("id, barcode, name, brand, description, image_urls, calories, protein, fat, carbs").single();
      if (error) throw error;
      const product: Product = { ...data, imageUrl: data.image_urls?.[0], calories: Number(data.calories), protein: Number(data.protein), fat: Number(data.fat), carbs: Number(data.carbs) };
      setProducts([product]); setMissingBarcode(""); setProductPhotos([]); setIsProductModalOpen(false); message.success("Товар добавлен в общую базу приложения."); await addProduct(product);
    } catch (error) { message.error(error instanceof Error ? `Не удалось сохранить товар: ${error.message}` : "Не удалось сохранить товар."); } finally { setProductSaving(false); }
  }
  async function saveProfile(values: { displayName: string }) { if (!session || !isSupabaseConfigured) return; const displayName = values.displayName.trim(); const { error } = await createClient().from("profiles").upsert({ id: session.user.id, display_name: displayName || null }, { onConflict: "id" }); if (error) return message.error(`Не удалось сохранить имя: ${error.message}`); setProfileName(displayName); message.success("Имя сохранено"); }
  async function saveCalculator() { if (!session || !isSupabaseConfigured) return; if (!calculator.sex || !calculator.age || !calculator.weight || !calculator.height || !calculator.activity || !calculator.goal) return message.error("Заполните все поля калькулятора."); const { error } = await createClient().from("profiles").upsert({ id: session.user.id, sex: calculator.sex, age: calculator.age, weight: calculator.weight, height: calculator.height, activity: calculator.activity, goal: calculator.goal }, { onConflict: "id" }); if (error) return message.error(`Не удалось сохранить параметры: ${error.message}`); message.success("Параметры сохранены"); }
  return <main className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark"><FireOutlined /></span>myFitnea</div>{session && <Space><Space.Compact className="section-nav"><Link href="/"><Button>Тренировки</Button></Link><Button type="primary">Питание</Button></Space.Compact><Tag icon={<UserOutlined />} color="green">{displayName}</Tag><Button icon={<LogoutOutlined />} onClick={signOut}>Выйти</Button></Space>}</header>{!session ? <Card className="auth-card"><Tabs items={[{ key: "login", label: "Войти", children: <AuthForm submitText="Войти" loading={authLoading} onSubmit={login} /> }, { key: "register", label: "Регистрация", children: <AuthForm submitText="Создать аккаунт" loading={authLoading} onSubmit={register} /> }]} /><Divider plain>или</Divider><Button size="large" block icon={<GoogleOutlined />} onClick={signInWithGoogle}>Продолжить с Google</Button>{!isSupabaseConfigured && <Alert className="config-alert" type="warning" message="Добавьте настройки Supabase в .env.local" />}</Card> : <><section className="hero"><div><Typography.Text className="eyebrow">ПЛАН НА СЕГОДНЯ</Typography.Text><Typography.Title>Привет, {displayName}!</Typography.Title><Typography.Paragraph>Отслеживайте рацион, чтобы уверенно идти к своей цели.</Typography.Paragraph></div><div className="calorie-orb"><FireOutlined /><strong>{target?.calories ?? "—"}</strong><span>ккал в день</span></div></section><section className="dashboard-grid"><Card title="Калькулятор нормы" className="panel" variant="borderless"><div className="calculator-grid"><label>Пол<Select value={calculator.sex} placeholder="Выберите" onChange={(sex) => setCalculator({ ...calculator, sex: sex as Calculator["sex"] })} options={[{ value: "female", label: "Женский" }, { value: "male", label: "Мужской" }]} /></label><label>Возраст<InputNumber min={14} max={100} value={calculator.age} placeholder="Лет" onChange={(age) => setCalculator({ ...calculator, age: age ? Number(age) : undefined })} /></label><label>Вес<InputNumber min={35} max={250} value={calculator.weight} placeholder="Кг" onChange={(weight) => setCalculator({ ...calculator, weight: weight ? Number(weight) : undefined })} addonAfter="кг" /></label><label>Рост<InputNumber min={120} max={230} value={calculator.height} placeholder="См" onChange={(height) => setCalculator({ ...calculator, height: height ? Number(height) : undefined })} addonAfter="см" /></label><label>Активность<Select value={calculator.activity} placeholder="Выберите" onChange={(activity) => setCalculator({ ...calculator, activity: Number(activity) })} options={[{ value: 1.2, label: "Минимальная" }, { value: 1.375, label: "Лёгкая" }, { value: 1.55, label: "Средняя" }, { value: 1.725, label: "Высокая" }]} /></label><label>Цель<Select value={calculator.goal} placeholder="Выберите" onChange={(goal) => setCalculator({ ...calculator, goal: goal as Calculator["goal"] })} options={[{ value: "lose", label: "Снижение веса" }, { value: "maintain", label: "Поддержание" }, { value: "gain", label: "Набор массы" }]} /></label></div><div className="calculator-actions"><Typography.Text type="secondary">{target ? "Расчёт готов. Сохраните параметры, чтобы они остались в вашем профиле." : "Заполните все поля, чтобы получить расчёт."}</Typography.Text><Button type="primary" onClick={() => void saveCalculator()} disabled={!target}>Сохранить параметры</Button></div><div className="macro-grid"><Statistic title="Калории" value={target?.calories ?? "—"} suffix={target ? "ккал" : ""} /><Statistic title="Белки" value={target?.protein ?? "—"} suffix={target ? "г" : ""} /><Statistic title="Жиры" value={target?.fat ?? "—"} suffix={target ? "г" : ""} /><Statistic title="Углеводы" value={target?.carbs ?? "—"} suffix={target ? "г" : ""} /></div></Card><Card title="Дневник на сегодня" className="panel diary" variant="borderless" extra={<Tag color="green">Осталось {target ? Math.max(0, target.calories - eaten) : "—"} ккал</Tag>}><Progress percent={target ? Math.min(100, Math.round((eaten / target.calories) * 100)) : 0} strokeColor="#3f9c76" railColor="#e7f0eb" /><div className="eaten-row"><strong>{eaten}</strong><span>из {target?.calories ?? "—"} ккал</span></div><div className="entry-list">{entries.length ? entries.map((entry) => <div className="entry" key={entry.entryId}><div><strong>{entry.name}</strong><span>{entry.meal} · Б {entry.protein} · Ж {entry.fat} · У {entry.carbs}</span></div><Space><b>{entry.calories} ккал</b><Button type="text" danger aria-label={`Удалить ${entry.name}`} icon={<DeleteOutlined />} onClick={() => void removeEntry(entry)} /></Space></div>) : <div className="empty-diary">В дневнике пока нет продуктов.</div>}</div></Card></section><section className="food-panel panel"><div className="food-heading"><div><Typography.Title level={2}>Добавить в дневник</Typography.Title><Typography.Text type="secondary">Сначала ищем в общей базе myFitnea, затем в Open Food Facts. Значения указаны на 100 г.</Typography.Text></div><Button type="primary" icon={<PlusOutlined />} onClick={() => { setMissingBarcode(barcode); setIsProductModalOpen(true); }}>Добавить в общую базу</Button></div><Segmented className="meal-picker" value={meal} options={["Завтрак", "Обед", "Ужин", "Перекус"]} onChange={(value) => setMeal(value as Meal)} /><Space.Compact className="search-row"><Input size="large" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найдите продукт по названию" prefix={<SearchOutlined />} /><Button size="large" loading={searchLoading} onClick={() => void searchProducts()}>Найти</Button></Space.Compact><div className="barcode-row"><Input value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))} onPressEnter={() => void searchProducts("", barcode)} placeholder="Штрихкод EAN/UPC" /><Button icon={<CameraOutlined />} onClick={() => void openScanner()}>Сканировать камерой</Button><Button onClick={() => void searchProducts("", barcode)}>Найти по коду</Button></div>{scannerMessage && <Alert type="warning" showIcon message={scannerMessage} />}{scannerOpen && <div className="scanner"><div className="scanner-preview"><video ref={videoRef} muted playsInline /><div className="scanner-guide" aria-hidden="true"><span className="scanner-corner scanner-corner-top-left" /><span className="scanner-corner scanner-corner-top-right" /><span className="scanner-corner scanner-corner-bottom-left" /><span className="scanner-corner scanner-corner-bottom-right" /><span className="scanner-line" /></div><div className="scanner-label">Поместите штрихкод в рамку</div></div><Typography.Text type="secondary">Штрихкод будет считан автоматически.</Typography.Text><Button onClick={stopScanner}>Закрыть камеру</Button></div>}<div className="product-list">{products.map((product) => <button className="product-item" key={product.id} onClick={() => void addProduct(product)}>{product.imageUrl && <img src={product.imageUrl} alt="" />}<span><strong>{product.name}</strong><small>{product.brand ? `${product.brand} · ` : ""}Б {product.protein} · Ж {product.fat} · У {product.carbs}</small></span><span><b>{product.calories}</b><small>ккал / 100 г</small></span><PlusOutlined /></button>)}</div>{(missingBarcode || (search.length >= 2 && !searchLoading && products.length === 0)) && <div className="no-products"><strong>{missingBarcode ? "Товар с этим штрихкодом не найден." : "Ничего не найдено."}</strong> Добавьте его один раз — и он станет доступен всем пользователям. <Button type="link" onClick={() => setIsProductModalOpen(true)}>Добавить товар в общую базу</Button></div>}</section><Card className="profile-card" title="Профиль"><Form key={profileName} layout="inline" initialValues={{ displayName }} onFinish={saveProfile}><Form.Item name="displayName" label="Ваше имя"><Input placeholder="Как к вам обращаться" /></Form.Item><Button htmlType="submit" type="primary">Сохранить имя</Button></Form></Card></>}<Modal title="Добавить товар в общую базу" open={isProductModalOpen} footer={null} onCancel={() => { setIsProductModalOpen(false); setProductPhotos([]); }}><Alert type="info" showIcon message="Карточку смогут находить и добавлять в дневник все пользователи приложения." /><Form layout="vertical" onFinish={createProduct} initialValues={{ barcode: missingBarcode || barcode, calories: 0, protein: 0, fat: 0, carbs: 0 }}><Form.Item name="barcode" label="Штрихкод"><Input inputMode="numeric" placeholder="EAN/UPC, если есть" /></Form.Item><Form.Item name="name" label="Название" rules={[{ required: true, message: "Введите название" }]}><Input placeholder="Например, йогурт греческий, 150 г" /></Form.Item><Form.Item name="brand" label="Бренд"><Input placeholder="Например, Простоквашино" /></Form.Item><Form.Item name="description" label="Описание"><Input.TextArea rows={2} placeholder="Вкус, размер упаковки, особенности" /></Form.Item><Form.Item label="Фотографии упаковки" required extra="От 1 до 3 фото: лицевая сторона, штрихкод и таблица КБЖУ."><Upload listType="picture-card" accept="image/jpeg,image/png,image/webp" capture="environment" fileList={productPhotos} beforeUpload={() => false} onChange={({ fileList }) => setProductPhotos(fileList.slice(0, 3))}>{productPhotos.length < 3 && "+ Фото"}</Upload></Form.Item><div className="product-form-grid"><Form.Item name="calories" label="Ккал / 100 г" rules={[{ required: true }]}><InputNumber min={0} className="full-width" /></Form.Item><Form.Item name="protein" label="Белки, г" rules={[{ required: true }]}><InputNumber min={0} step={0.1} className="full-width" /></Form.Item><Form.Item name="fat" label="Жиры, г" rules={[{ required: true }]}><InputNumber min={0} step={0.1} className="full-width" /></Form.Item><Form.Item name="carbs" label="Углеводы, г" rules={[{ required: true }]}><InputNumber min={0} step={0.1} className="full-width" /></Form.Item></div><Space className="modal-actions"><Button onClick={() => setIsProductModalOpen(false)}>Отмена</Button><Button type="primary" htmlType="submit" loading={productSaving}>Опубликовать и добавить в дневник </Button></Space></Form></Modal></main>;
}

export default function Home() { return <ConfigProvider theme={{ token: { colorPrimary: "#237a58", borderRadius: 14, fontFamily: "Arial, sans-serif" } }}><App><HomeContent /></App></ConfigProvider>; }