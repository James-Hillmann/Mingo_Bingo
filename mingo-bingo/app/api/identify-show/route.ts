import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { songName, shows } = await req.json();

  if (!songName || !shows || shows.length === 0) {
    return NextResponse.json({ error: "Missing songName or shows" }, { status: 400 });
  }

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `You are helping with a TV show bingo game. A theme song is playing and we need to know which TV show it belongs to.

Song name: "${songName}"

TV shows on the bingo board:
${shows.map((s: string) => `- ${s}`).join("\n")}

Which TV show from the list above has this as its theme song? Reply with ONLY the exact show name from the list, nothing else. If none match, reply with "unknown".`,
      },
    ],
  });

  const result = (message.content[0] as { type: string; text: string }).text.trim();
  const matched = shows.find((s: string) => s.toLowerCase() === result.toLowerCase()) ?? null;

  return NextResponse.json({ show: matched ?? (result === "unknown" ? null : result) });
}
