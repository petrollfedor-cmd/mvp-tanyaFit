import { NextResponse } from "next/server";

type OffProduct = { code?: string; product_name?: string; product_name_en?: string; brands?: string; image_front_small_url?: string; nutriments?: Record<string, number | undefined> };
const cache = new Map<string, { expiresAt: number; products: unknown[] }>();
const fields = "code,product_name,product_name_en,brands,image_front_small_url,nutriments";

function toProduct(product: OffProduct) {
  const nutriments = product.nutriments ?? {};
  return { id: `off-${product.code}`, barcode: product.code ?? "", name: product.product_name || product.product_name_en || "Продукт без названия", brand: product.brands ?? "", imageUrl: product.image_front_small_url ?? "", calories: Number(nutriments["energy-kcal_100g"] ?? nutriments["energy-kcal"] ?? 0), protein: Number(nutriments.proteins_100g ?? 0), fat: Number(nutriments.fat_100g ?? 0), carbs: Number(nutriments.carbohydrates_100g ?? 0) };
}

async function requestOpenFoodFacts(url: URL) {
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "myFitnea/0.1 (product lookup; contact: support@myfitnea.local)", Accept: "application/json" } });
  if (response.status === 429) throw new Error("Сервис продуктов временно ограничил запросы. Повторите немного позже.");
  if (!response.ok) throw new Error("Не удалось получить данные о продукте.");
  return response.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get("barcode")?.replace(/\D/g, "") ?? "";
  const query = searchParams.get("q")?.trim() ?? "";
  if (!barcode && query.length < 2) return NextResponse.json({ products: [] });
  const cacheKey = barcode ? `barcode:${barcode}` : `query:${query.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ products: cached.products, cached: true });
  try {
    let products: unknown[];
    if (barcode) {
      const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      url.searchParams.set("fields", fields);
      const data = await requestOpenFoodFacts(url) as { product?: OffProduct; status?: number };
      products = data.status === 1 && data.product ? [toProduct(data.product)] : [];
    } else {
      const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
      url.searchParams.set("search_terms", query); url.searchParams.set("search_simple", "1"); url.searchParams.set("action", "process"); url.searchParams.set("json", "1"); url.searchParams.set("page_size", "12"); url.searchParams.set("fields", fields);
      const data = await requestOpenFoodFacts(url) as { products?: OffProduct[] };
      products = (data.products ?? []).filter((product) => product.code && (product.product_name || product.product_name_en)).map(toProduct);
    }
    cache.set(cacheKey, { expiresAt: Date.now() + 15 * 60 * 1000, products });
    return NextResponse.json({ products }, { headers: { "Cache-Control": "public, max-age=900" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка поиска продуктов." }, { status: 502 }); }
}