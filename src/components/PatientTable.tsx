import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Brain, Heart, Wind, Flower2, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { Patient } from '@/utils/patientData';
import { useNavigate } from 'react-router-dom';

interface PatientTableProps {
  patients: Patient[];
  pedName: string;
  averagePelod: number;
  showTitle?: boolean;
}

export const PatientTable = ({ patients, pedName, averagePelod, showTitle = true }: PatientTableProps) => {
  const navigate = useNavigate();

  const getAdherenceColor = (adherence: number) => {
    if (adherence >= 85) return 'text-green-600';
    if (adherence >= 70) return 'text-orange-500';
    return 'text-red-600';
  };

  const getOrganIcon = (organ: 'brain' | 'heart' | 'lungs' | 'kidney', score?: number) => {
    const getColor = (score?: number) => {
      if (!score || score === 0) return 'text-gray-300';
      if (score === 1) return 'text-orange-400';
      if (score === 2) return 'text-orange-500';
      return 'text-red-500';
    };

    const color = getColor(score);
    
    switch (organ) {
      case 'brain':
        return <Brain className={`h-6 w-6 ${color}`} />;
      case 'heart':
        return <Heart className={`h-6 w-6 ${color} fill-current`} />;
      case 'lungs':
        return <Wind className={`h-6 w-6 ${color}`} />;
      case 'kidney':
        return <Flower2 className={`h-6 w-6 ${color}`} />;
    }
  };

  return (
    <div className="space-y-3">
      {showTitle && (
        <h2 className="text-xl font-medium text-primary">
          Patient Status {pedName}
        </h2>
      )}
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-200">
              <TableHead className="font-medium text-gray-700">Patient Informations</TableHead>
              <TableHead className="font-medium text-gray-700">Age</TableHead>
              <TableHead className="font-medium text-gray-700">
                <div className="flex items-center gap-1">
                  #D PICU
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="font-medium text-gray-700">
                <div className="flex items-center gap-1">
                  PELOD (/70)
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="font-medium text-gray-700">Global Adherence (%)</TableHead>
              <TableHead className="font-medium text-gray-700">Admission Diagnosis</TableHead>
              <TableHead className="font-medium text-gray-700">Exams</TableHead>
              <TableHead className="font-medium text-gray-700">Alarms</TableHead>
              <TableHead className="font-medium text-gray-700">Tour</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient, index) => (
              <TableRow 
                key={patient.id}
                className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                onClick={() => navigate(`/optistats?patient=${patient.id}`)}
              >
                <TableCell className="py-4">
                  <div className="font-medium text-red-500">{patient.id} {patient.name}</div>
                  <div className="text-sm text-gray-500">{patient.weight}</div>
                </TableCell>
                <TableCell className="text-gray-700">{patient.age}</TableCell>
                <TableCell className="text-gray-700">{patient.picuId}</TableCell>
                <TableCell>
                  <span className="font-semibold text-lg text-gray-900">
                    {patient.pelodScore}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`font-medium ${getAdherenceColor(patient.adherence)}`}>
                    {patient.adherence}%
                  </span>
                </TableCell>
                <TableCell className="text-gray-700">{patient.diagnosis}</TableCell>
                <TableCell>
                  {patient.exam && (
                    <span className="text-sm text-gray-600">{patient.exam}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {getOrganIcon('brain', patient.brainScore)}
                    {getOrganIcon('heart', patient.heartScore)}
                    {getOrganIcon('lungs', patient.lungsScore)}
                    {getOrganIcon('kidney', patient.kidneyScore)}
                  </div>
                </TableCell>
                <TableCell>
                  {patient.tour && (
                    <Badge 
                      variant={patient.tour === 'Priority' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {patient.tour}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
