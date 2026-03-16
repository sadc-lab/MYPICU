import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un assistant clinique spécialisé en soins intensifs pédiatriques (PICU). Tu aides les cliniciens à prendre des décisions basées sur les données patient.

## Rôle
- Analyser les données vitales, médicaments, scores et indicateurs cliniques du patient
- Fournir des recommandations basées sur les guidelines PICU générales
- Alerter sur les valeurs anormales ou tendances préoccupantes
- Suggérer des interventions appropriées

## Guidelines PICU générales
- PIC (Pression Intracrânienne) : cible < 20 mmHg. Élévation = urgence neurochirurgicale potentielle
- PPC (Pression de Perfusion Cérébrale) : cible 60-70 mmHg pour neuroprotection
- PAM (Pression Artérielle Moyenne) : adapter selon l'âge et la pathologie
- PVC (Pression Veineuse Centrale) : surveiller la volémie
- FC (Fréquence Cardiaque) : adapter selon l'âge
- Température : cible 35-38°C, éviter l'hyperthermie en neuroréanimation
- PaCO2 : cible 35-45 mmHg, normocapnie sauf indication contraire
- ETCO2 : corrélation avec PaCO2, surveiller le gradient
- Glycémie : cible 6-11 mmol/L, éviter hypo et hyperglycémie
- Hémoglobine : seuil transfusionnel > 7 g/dL
- INR : cible < 1.2, risque hémorragique si élevé
- Plaquettes : cible > 100 G/L en neuroréanimation
- Score PELOD : évaluation de la sévérité, mortalité prédite
- GCS (Glasgow Coma Scale) : évaluation neurologique 3-15

## Médicaments à surveiller
- Opioïdes : sédation, dépression respiratoire, tolérance
- Hypnotiques (Propofol) : syndrome de perfusion du propofol si > 48h ou doses élevées
- Anti-épileptiques : niveaux thérapeutiques, interactions

## Format de réponse
- Sois concis et structuré
- Utilise des listes à puces
- Indique le niveau d'urgence quand pertinent (🔴 urgent, 🟡 attention, 🟢 normal)
- Base tes recommandations sur les données fournies
- Précise toujours que les recommandations doivent être validées par l'équipe médicale

## Important
- Tu ne poses PAS de diagnostic
- Tu aides à la DÉCISION, tu ne remplaces PAS le clinicien
- Toujours préciser les limites de ton analyse`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, patientId, mode, organ } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch patient context if patientId is provided
    let patientContext = "";
    if (patientId) {
      patientContext = await buildPatientContext(supabase, patientId, organ);
    }

    const systemMessage = patientContext
      ? `${SYSTEM_PROMPT}\n\n## Données patient actuelles\n${patientContext}`
      : SYSTEM_PROMPT;

    // For recommendations mode, use a specific prompt
    const finalMessages = mode === "recommendations"
      ? [
          { role: "system", content: systemMessage },
          {
            role: "user",
            content: `Analyse les données de ce patient et fournis 3-5 recommandations cliniques prioritaires${organ ? ` pour le module ${organ}` : ""}. Format: liste concise avec niveau d'urgence.`,
          },
        ]
      : [{ role: "system", content: systemMessage }, ...messages];

    const isStreaming = mode !== "recommendations";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: finalMessages,
        stream: isStreaming,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés. Veuillez recharger votre compte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isStreaming) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } else {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "Aucune recommandation disponible.";
      return new Response(JSON.stringify({ recommendations: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("CDSS agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function buildPatientContext(supabase: any, patientId: string, organ?: string): Promise<string> {
  const dbPatientId = patientId.startsWith("#") ? patientId : `#${patientId}`;
  const normalizedId = patientId.replace("#", "");

  try {
    // Fetch patient info, vitals (latest), medications, and clinical info in parallel
    const [patientRes, vitalsRes, medsRes, clinicalRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", dbPatientId).single(),
      supabase
        .from("patient_vitals")
        .select("variable_key, charttime, valeur")
        .eq("patient_id", dbPatientId)
        .order("charttime", { ascending: false })
        .limit(200),
      supabase
        .from("patient_medications")
        .select("medication_type, drugname, charttime, valeur")
        .eq("patient_id", dbPatientId)
        .order("charttime", { ascending: false })
        .limit(50),
      supabase
        .from("patient_clinical_info")
        .select("info_type, data")
        .eq("patient_id", dbPatientId),
    ]);

    let context = "";

    // Patient demographics
    if (patientRes.data) {
      const p = patientRes.data;
      context += `### Informations patient\n`;
      context += `- ID: ${p.id}, Nom: ${p.name}, Âge: ${p.age}, Poids: ${p.weight}\n`;
      context += `- Diagnostic: ${p.diagnosis}\n`;
      context += `- Score PELOD: ${p.pelod_score ?? "N/A"}, GCS: ${p.gcs ?? "N/A"}\n`;
      context += `- Adhérence globale: ${p.adherence ?? "N/A"}%\n`;
      context += `- Scores organes - Cerveau: ${p.brain_score ?? "N/A"}, Cœur: ${p.heart_score ?? "N/A"}, Poumons: ${p.lungs_score ?? "N/A"}, Reins: ${p.kidney_score ?? "N/A"}\n\n`;
    }

    // Latest vitals (grouped by variable)
    if (vitalsRes.data && vitalsRes.data.length > 0) {
      const latestByVar = new Map<string, { charttime: string; valeur: number }>();
      for (const v of vitalsRes.data) {
        if (!latestByVar.has(v.variable_key)) {
          latestByVar.set(v.variable_key, { charttime: v.charttime, valeur: v.valeur });
        }
      }
      context += `### Dernières valeurs vitales\n`;
      for (const [key, val] of latestByVar) {
        const label = key.replace("Variable_", "");
        context += `- ${label}: ${val.valeur} (${val.charttime})\n`;
      }
      context += "\n";
    }

    // Active medications
    if (medsRes.data && medsRes.data.length > 0) {
      const uniqueMeds = new Map<string, { type: string; lastTime: string; valeur: string | null }>();
      for (const m of medsRes.data) {
        if (!uniqueMeds.has(m.drugname)) {
          uniqueMeds.set(m.drugname, { type: m.medication_type, lastTime: m.charttime, valeur: m.valeur });
        }
      }
      context += `### Médicaments actifs\n`;
      for (const [drug, info] of uniqueMeds) {
        context += `- ${drug} (${info.type})${info.valeur ? ` - ${info.valeur}` : ""} - dernière admin: ${info.lastTime}\n`;
      }
      context += "\n";
    }

    // Clinical info
    if (clinicalRes.data && clinicalRes.data.length > 0) {
      context += `### Informations cliniques\n`;
      for (const info of clinicalRes.data) {
        context += `- ${info.info_type}: ${JSON.stringify(info.data)}\n`;
      }
      context += "\n";
    }

    return context;
  } catch (error) {
    console.error("Error building patient context:", error);
    return "Erreur lors de la récupération des données patient.";
  }
}
