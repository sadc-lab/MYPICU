import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Heart, Wind } from 'lucide-react';
import { Patient } from '@/utils/patientData';
import { useNavigate } from 'react-router-dom';

interface PatientCardProps {
  patient: Patient;
}

export const PatientCard = ({ patient }: PatientCardProps) => {
  const navigate = useNavigate();

  const getScoreColor = (score?: number) => {
    if (!score) return 'bg-muted';
    if (score >= 3) return 'bg-destructive';
    if (score >= 2) return 'bg-warning';
    return 'bg-success';
  };

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => navigate(`/optistats?patient=${patient.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg">{patient.name}</h3>
            <p className="text-sm text-muted-foreground">{patient.picuId}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{patient.pelodScore}</div>
            <div className="text-xs text-muted-foreground">PELOD</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
          <div>
            <span className="text-muted-foreground">Age:</span> {patient.age}
          </div>
          <div>
            <span className="text-muted-foreground">Weight:</span> {patient.weight}
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Diagnosis:</span> {patient.diagnosis}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getScoreColor(patient.brainScore)}`}>
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getScoreColor(patient.heartScore)}`}>
              <Heart className="h-4 w-4 text-white" />
            </div>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getScoreColor(patient.lungsScore)}`}>
              <Wind className="h-4 w-4 text-white" />
            </div>
          </div>
          <Badge variant={patient.priority === 'Critical' ? 'destructive' : 'secondary'}>
            {patient.priority}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
