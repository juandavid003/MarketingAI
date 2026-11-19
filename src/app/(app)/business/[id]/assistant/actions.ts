"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { businessAi } from "@/lib/aiCredentials";
import { callProvider, resolveModel } from "@/lib/ai";
import { toAiBusiness } from "@/lib/businessContext";
import { shortErrorMessage } from "@/lib/errors";
import { loadAssistantData } from "@/lib/assistantData";
import {
  buildAssistantPrompt,
  buildFacts,
  DAILY_QUESTION_LIMIT,
  MAX_QUESTION_CHARS,
  type ChatTurn,
} from "@/lib/assistant";
import { daysAgo } from "@/lib/contentPlan";

export type AskState = { error?: string; asked?: number };

const HISTORY_TURNS = 6;

export async function askAssistant(businessId: string, prev: AskState, formData: FormData): Promise<AskState> {
  const { user, business } = await requireBusinessAccess(businessId);
  const question = String(formData.get("question") ?? "").trim();
  if (question.length < 3) return { error: "Escribe tu pregunta." };
  if (question.length > MAX_QUESTION_CHARS) return { error: `Máximo ${MAX_QUESTION_CHARS} caracteres.` };

  const ai = businessAi(business);
  if (!ai) return { error: "Este negocio todavía no tiene configurada su IA." };

  const askedToday = await prisma.assistantMessage.count({
    where: { businessId, userId: user.id, role: "user", createdAt: { gte: daysAgo(1) } },
  });
  if (askedToday >= DAILY_QUESTION_LIMIT) {
    return { error: `Llegaste al límite de ${DAILY_QUESTION_LIMIT} preguntas en 24 horas. Vuelve más tarde.` };
  }

  const [full, recent, data] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, include: { products: true } }),
    prisma.assistantMessage.findMany({
      where: { businessId, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_TURNS,
      select: { role: true, content: true },
    }),
    loadAssistantData(business),
  ]);

  const facts = buildFacts(data);
  const history: ChatTurn[] = recent.reverse().map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  const prompt = buildAssistantPrompt({
    business: toAiBusiness(full),
    facts,
    history,
    question,
    today: new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  });

  const model = resolveModel(ai.provider, ai.model);
  let answer: string;
  try {
    answer = (await callProvider(ai.provider, ai.apiKey, model, prompt, 1200)).trim();
  } catch (err) {
    return { error: shortErrorMessage(err, "La IA no respondió. Intenta de nuevo.") };
  }

  // Question and answer are saved together, so a failed call leaves no
  // unanswered question behind.
  const askedAt = Date.now();
  await prisma.assistantMessage.createMany({
    data: [
      { businessId, userId: user.id, role: "user", content: question, createdAt: new Date(askedAt) },
      {
        businessId,
        userId: user.id,
        role: "assistant",
        content: answer,
        facts: JSON.stringify(facts),
        provider: ai.provider,
        model,
        // Strictly after the question so ordering by createdAt is stable.
        createdAt: new Date(askedAt + 1),
      },
    ],
  });

  revalidatePath(`/business/${businessId}/assistant`);
  return { asked: (prev.asked ?? 0) + 1 };
}

export async function clearConversation(businessId: string) {
  const { user } = await requireBusinessAccess(businessId);
  await prisma.assistantMessage.deleteMany({ where: { businessId, userId: user.id } });
  revalidatePath(`/business/${businessId}/assistant`);
}
