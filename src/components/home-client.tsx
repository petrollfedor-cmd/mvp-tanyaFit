"use client";

import dynamic from "next/dynamic";

const NutritionDashboard = dynamic(() => import("@/components/nutrition-dashboard"), { ssr: false });

export default function HomeClient() {
  return <NutritionDashboard />;
}