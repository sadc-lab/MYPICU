import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ImportStatus {
  patientId: string;
  status: 'pending' | 'importing' | 'done' | 'error';
  vitals: number;
  medications: number;
  validity: number;
  clinicalInfo: number;
  errors: string[];
}

const PATIENT_FILES = ['6312', '8448', '8749'];

// Time-series variable keys
const TIME_SERIES_KEYS = [
  'Variable_FC', 'Variable_PIC', 'Variable_PPC', 'Variable_PAM',
  'Variable_PVC', 'Variable_temperature', 'Variable_EtCO2', 'Variable_SPO2',
  'Variable_plaquettes', 'Variable_hemoglobine', 'Variable_glycemie',
  'Variable_INR', 'Variable_paco2', 'Variable_position_tete',
  'Variable_pupille_droite', 'Variable_pupille_gauche',
];

const MEDICATION_KEYS: Record<string, string> = {
  Variable_anti_epileptique: 'anti_epileptique',
  Variable_opioides: 'opioides',
  Variable_hypnotiques: 'hypnotiques',
};

const CLINICAL_INFO_KEYS = [
  'Variable_age', 'Variable_premiere_frequence_cardiaque',
  'Variable_concentre_plaquettaire', 'Variable_culot_globulaire',
  'Variable_plasma', 'Variable_nutrition',
];

function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

const ImportPatientData = () => {
  const [statuses, setStatuses] = useState<ImportStatus[]>(
    PATIENT_FILES.map(id => ({
      patientId: id, status: 'pending',
      vitals: 0, medications: 0, validity: 0, clinicalInfo: 0, errors: [],
    }))
  );
  const [isImporting, setIsImporting] = useState(false);

  const updateStatus = (patientId: string, updates: Partial<ImportStatus>) => {
    setStatuses(prev => prev.map(s =>
      s.patientId === patientId ? { ...s, ...updates } : s
    ));
  };

  const importPatient = async (patientId: string) => {
    updateStatus(patientId, { status: 'importing', vitals: 0, medications: 0, validity: 0, clinicalInfo: 0, errors: [] });

    try {
      // Load JSON file
      const response = await fetch(`/data/patients/${patientId}.json`);
      if (!response.ok) throw new Error(`Failed to load JSON for patient ${patientId}`);
      const data = await response.json();

      const dbPatientId = `#${patientId}`;
      const errors: string[] = [];
      let totalVitals = 0, totalMeds = 0, totalValidity = 0, totalClinical = 0;

      // 1. Import vitals - one variable at a time in batches
      for (const key of TIME_SERIES_KEYS) {
        const arr = data[key];
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

        for (let i = 0; i < rows.length; i += 2000) {
          const batch = rows.slice(i, i + 2000);
          const { error } = await supabase.from('patient_vitals').insert(batch);
          if (error) {
            errors.push(`${key}: ${error.message}`);
          } else {
            totalVitals += batch.length;
            updateStatus(patientId, { vitals: totalVitals });
          }
        }
      }

      // 2. Import medications
      for (const [jsonKey, medType] of Object.entries(MEDICATION_KEYS)) {
        const arr = data[jsonKey];
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

        for (let i = 0; i < rows.length; i += 2000) {
          const batch = rows.slice(i, i + 2000);
          const { error } = await supabase.from('patient_medications').insert(batch);
          if (error) {
            errors.push(`${jsonKey}: ${error.message}`);
          } else {
            totalMeds += batch.length;
            updateStatus(patientId, { medications: totalMeds });
          }
        }
      }

      // 3. Import validity data
      for (const [key, value] of Object.entries(data)) {
        if (!key.endsWith('_validite')) continue;
        const arr = value as any[];
        if (!Array.isArray(arr) || arr.length === 0) continue;

        const item = arr[0];
        const rows: any[] = [];

        for (const [hKey, hVal] of Object.entries(item)) {
          if (!hKey.startsWith('H')) continue;
          const hourIndex = parseInt(hKey.replace('H', ''));
          if (isNaN(hourIndex)) continue;

          rows.push({
            patient_id: dbPatientId,
            indicator_key: key,
            hour_index: hourIndex,
            is_adherent: hVal === 0,
          });
        }

        if (rows.length > 0) {
          const { error } = await supabase.from('patient_validity').insert(rows);
          if (error) {
            errors.push(`${key}: ${error.message}`);
          } else {
            totalValidity += rows.length;
            updateStatus(patientId, { validity: totalValidity });
          }
        }
      }

      // 4. Import clinical info
      for (const key of CLINICAL_INFO_KEYS) {
        const arr = data[key];
        if (!Array.isArray(arr) || arr.length === 0) continue;

        const { error } = await supabase.from('patient_clinical_info').insert({
          patient_id: dbPatientId,
          info_type: key,
          data: arr,
        });

        if (error) {
          errors.push(`${key}: ${error.message}`);
        } else {
          totalClinical++;
          updateStatus(patientId, { clinicalInfo: totalClinical });
        }
      }

      updateStatus(patientId, {
        status: errors.length > 0 ? 'error' : 'done',
        errors,
      });
    } catch (err: any) {
      updateStatus(patientId, { status: 'error', errors: [err.message] });
    }
  };

  const handleImportAll = async () => {
    setIsImporting(true);
    for (const file of PATIENT_FILES) {
      await importPatient(file);
    }
    setIsImporting(false);
    toast.success('Import terminé');
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Import des données patients</h1>
      <p className="text-muted-foreground mb-6">
        Importe les fichiers JSON patients dans les tables Supabase structurées.
      </p>

      <Button onClick={handleImportAll} disabled={isImporting} className="mb-6">
        {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {isImporting ? 'Import en cours...' : 'Importer tous les patients'}
      </Button>

      <div className="space-y-4">
        {statuses.map(s => (
          <Card key={s.patientId}>
            <CardHeader className="py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                Patient #{s.patientId}
                {s.status === 'done' && <CheckCircle className="h-5 w-5 text-green-500" />}
                {s.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
                {s.status === 'importing' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">Vitaux: {s.vitals}</Badge>
                <Badge variant="outline">Médications: {s.medications}</Badge>
                <Badge variant="outline">Validité: {s.validity}</Badge>
                <Badge variant="outline">Clinique: {s.clinicalInfo}</Badge>
              </div>
              {s.errors.length > 0 && (
                <div className="mt-2 text-xs text-destructive max-h-20 overflow-y-auto">
                  {s.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ImportPatientData;
