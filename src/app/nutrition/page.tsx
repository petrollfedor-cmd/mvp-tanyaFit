import HomeClient from "@/components/home-client";
import { connection } from "next/server";

export default async function NutritionPage() {
  await connection();
  return <HomeClient />;
}