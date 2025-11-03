import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Brain, Heart, Wind, Activity, Thermometer } from 'lucide-react';
import { Patient } from '@/utils/patientData';
import { useNavigate } from 'react-router-dom';

interface PatientTableProps {
  patients: Patient[];
  pedName: string;
  averagePelod: number;
}

export const PatientTable = ({ patients, pedName, averagePelod }: PatientTableProps) => {
  const navigate = useNavigate();

  const getPelodColor = (score: number) => {
    if (score >= 25) return 'text-destructive';
    if (score >= 15) return 'text-warning';
    return 'text-success';
  };

  const getAdherenceColor = (adherence: number) => {
    if (adherence >= 85) return 'text-success';
    if (adherence >= 70) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 3) return 'text-destructive';
    if (score >= 2) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-primary">
        {pedName} - Patient Status - PELOD: {averagePelod}/70
      </h2>
      
      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[200px]">Patient Info</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>#D PICU</TableHead>
              <TableHead>PELOD</TableHead>
              <TableHead>Adherence</TableHead>
              <TableHead>Diagnosis</TableHead>
              <TableHead>Exams</TableHead>
              <TableHead>Alarms</TableHead>
              <TableHead>Tour</TableHead>
              <TableHead>Visit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient) => (
              <TableRow 
                key={patient.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/optistats?patient=${patient.id}`)}
              >
                <TableCell>
                  <div className="font-medium">{patient.name}</div>
                  <div className="text-sm text-muted-foreground">{patient.weight}</div>
                </TableCell>
                <TableCell>{patient.age}</TableCell>
                <TableCell>{patient.picuId}</TableCell>
                <TableCell>
                  <span className={`font-bold text-lg ${getPelodColor(patient.pelodScore)}`}>
                    {patient.pelodScore}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`font-semibold ${getAdherenceColor(patient.adherence)}`}>
                    {patient.adherence}%
                  </span>
                </TableCell>
                <TableCell className="max-w-[200px]">{patient.diagnosis}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Brain className={`h-5 w-5 ${getScoreColor(patient.brainScore)}`} />
                    <Thermometer className={`h-5 w-5 ${getScoreColor(patient.heartScore)}`} />
                    <Heart className={`h-5 w-5 ${getScoreColor(patient.heartScore)}`} />
                    <Activity className={`h-5 w-5 ${getScoreColor(patient.lungsScore)}`} />
                    <Wind className={`h-5 w-5 ${getScoreColor(patient.lungsScore)}`} />
                  </div>
                </TableCell>
                <TableCell>
                  {patient.exam && (
                    <Badge variant="outline" className="text-xs">
                      {patient.exam}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>—</TableCell>
                <TableCell>—</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
