import TrainingClient from "@/components/training-client";
import { connection } from "next/server";

export default async function Home() {
  await connection();
  return <TrainingClient />;
}
