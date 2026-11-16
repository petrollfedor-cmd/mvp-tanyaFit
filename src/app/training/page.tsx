import TrainingClient from "@/components/training-client";
import { connection } from "next/server";

export default async function TrainingPage() {
  await connection();
  return <TrainingClient />;
}