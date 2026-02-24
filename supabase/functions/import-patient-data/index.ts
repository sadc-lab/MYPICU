import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Time-series variable keys that contain {charttime, valeur}
const TIME_SERIES_KEYS = [
  "Variable_FC",
  "Variable_PIC",
  "Variable_PPC",
  "Variable_PAM",
  "Variable_PVC",
  "Variable_temperature",
  "Variable_EtCO2",
  "Variable_SPO2",
  "Variable_plaquettes",
  "Variable_hemoglobine",
  "Variable_glycemie",
  "Variable_INR",
  "Variable_paco2",
  "Variable_position_tete",
  "Variable_pupille_droite",
  "Variable_pupille_gauche",
];

// Medication keys
const MEDICATION_KEYS: Record<string, string> = {
  Variable_anti_epileptique: "anti_epileptique",
  Variable_opioides: "opioides",
  Variable_hypnotiques: "hypnotiques",
};

// Validity keys (end with _validite)
const isValidityKey = (key: string) => key.endsWith("_validite");

// Clinical info keys
const CLINICAL_INFO_KEYS = [
  "Variable_age",
  "Variable_premiere_frequence_cardiaque",
  "Variable_concentre_plaquettaire",
  "Variable_culot_globulaire",
  "Variable_plasma",
  "Variable_nutrition",
];

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { patientId, data: patientData } = await req.json();

    if (!patientId || !patientData) {
      return new Response(
        JSON.stringify({ error: "patientId and data are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format patient ID with # prefix for DB foreign key
    const dbPatientId = patientId.startsWith("#") ? patientId : `#${patientId}`;

    const results = {
      vitals: 0,
      medications: 0,
      validity: 0,
      clinical_info: 0,
      errors: [] as string[],
    };

    // 1. Import time-series vitals
    for (const key of TIME_SERIES_KEYS) {
      const arr = patientData[key];
      if (!Array.isArray(arr) || arr.length === 0) continue;

      const rows = arr
        .filter((item: any) => item.charttime)
        .map((item: any) => ({
          patient_id: dbPatientId,
          variable_key: key,
          charttime: item.charttime,
          valeur: parseNumericValue(item.valeur),
        }))
        .filter((r: any) => r.valeur !== null);

      // Insert in batches of 5000
      for (let i = 0; i < rows.length; i += 5000) {
        const batch = rows.slice(i, i + 5000);
        const { error } = await supabase.from("patient_vitals").insert(batch);
        if (error) {
          results.errors.push(`vitals ${key} batch ${i}: ${error.message}`);
        } else {
          results.vitals += batch.length;
        }
      }
    }

    // 2. Import medications
    for (const [jsonKey, medType] of Object.entries(MEDICATION_KEYS)) {
      const arr = patientData[jsonKey];
      if (!Array.isArray(arr) || arr.length === 0) continue;

      const rows = arr
        .filter((item: any) => item.charttime && item.drugname)
        .map((item: any) => ({
          patient_id: dbPatientId,
          medication_type: medType,
          drugname: item.drugname,
          charttime: item.charttime,
          variable: item.variable || null,
          valeur: item.valeur?.toString() || null,
        }));

      for (let i = 0; i < rows.length; i += 5000) {
        const batch = rows.slice(i, i + 5000);
        const { error } = await supabase.from("patient_medications").insert(batch);
        if (error) {
          results.errors.push(`medications ${jsonKey}: ${error.message}`);
        } else {
          results.medications += batch.length;
        }
      }
    }

    // 3. Import validity data
    for (const [key, value] of Object.entries(patientData)) {
      if (!isValidityKey(key)) continue;
      const arr = value as any[];
      if (!Array.isArray(arr) || arr.length === 0) continue;

      const item = arr[0]; // Each validity key has one row with H0-H47
      const rows: any[] = [];

      for (const [hKey, hVal] of Object.entries(item)) {
        if (!hKey.startsWith("H")) continue;
        const hourIndex = parseInt(hKey.replace("H", ""));
        if (isNaN(hourIndex)) continue;

        rows.push({
          patient_id: dbPatientId,
          indicator_key: key,
          hour_index: hourIndex,
          is_adherent: hVal === 0, // 0 = adhérent, 1 = non adhérent
        });
      }

      if (rows.length > 0) {
        const { error } = await supabase.from("patient_validity").insert(rows);
        if (error) {
          results.errors.push(`validity ${key}: ${error.message}`);
        } else {
          results.validity += rows.length;
        }
      }
    }

    // 4. Import clinical info
    for (const key of CLINICAL_INFO_KEYS) {
      const arr = patientData[key];
      if (!Array.isArray(arr) || arr.length === 0) continue;

      const { error } = await supabase.from("patient_clinical_info").insert({
        patient_id: dbPatientId,
        info_type: key,
        data: arr,
      });

      if (error) {
        results.errors.push(`clinical_info ${key}: ${error.message}`);
      } else {
        results.clinical_info++;
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
