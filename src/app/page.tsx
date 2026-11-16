import HomeClient from "@/components/home-client";
import { connection } from "next/server";

export default async function Home() {
  await connection();
  return <HomeClient />;
}
