import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { JobDetailView } from "@/components/admin/import/JobDetailView";
import { requireAdmin } from "@/lib/auth";
import { jobTitle } from "@/lib/scraper/job";
import { getJob } from "@/lib/scraper/queries";

export async function generateMetadata({ params }: PageProps<"/admin/importar/[jobId]">): Promise<Metadata> {
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) return { title: "Importación" };
  const ctx = await requireAdmin();
  const job = await getJob(ctx.supabase, jobId);
  return { title: job ? `Importación · ${jobTitle(job)}` : "Importación" };
}

export default async function ImportJobPage({ params }: PageProps<"/admin/importar/[jobId]">) {
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) notFound();
  const ctx = await requireAdmin();
  const job = await getJob(ctx.supabase, jobId);
  if (!job) notFound();
  return <JobDetailView key={job.id} initialJob={job} />;
}
