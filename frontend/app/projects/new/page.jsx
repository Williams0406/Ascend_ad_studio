import { redirect } from "next/navigation";

export default async function LegacyWorkspaceRedirect({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams(params || {}).toString();
  redirect(`/workspace${query ? `?${query}` : ""}`);
}
