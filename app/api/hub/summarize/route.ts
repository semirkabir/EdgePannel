import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

export async function POST(request: NextRequest) {
    try {
        const { markets, notes } = await request.json()

        if (!markets?.length && !notes?.length) {
            return NextResponse.json({ error: 'No data to summarize' }, { status: 400 })
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

        const prompt = `
      You are a senior financial analyst and geopolitical strategist for EdgePannel.
      Summarize the following intelligence gathered by the user into a concise, professional research brief.
      
      Markets of Interest:
      ${markets.map((m: any) => `- ${m.title} (Probability: ${(m.price * 100).toFixed(0)}%, Platform: ${m.platform})`).join('\n')}
      
      User Research Notes:
      ${notes.map((n: any) => `- ${n.content}`).join('\n')}
      
      Structure your response with:
      1. CRITICAL ALPHA: The most important insight from the data.
      2. CONTRARIAN VIEW: What could the markets be missing?
      3. ACTIONABLE INTELLIGENCE: Specific recommendation for the user.
      
      Keep it high-signal, dark-terminal style. Use bold text for emphasis.
    `

        const result = await model.generateContent(prompt)
        const summary = result.response.text()

        return NextResponse.json({ summary })
    } catch (error: any) {
        console.error('[Summarize API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
