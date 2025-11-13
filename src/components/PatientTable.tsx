import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Brain, Wind, Droplets, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { Patient } from '@/types/patient.types';
import { Skeleton } from '@/components/ui/skeleton';
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

  const hasAlarms = (patient: Patient) => {
    return (patient.brainScore && patient.brainScore > 0) ||
           (patient.heartScore && patient.heartScore > 0) ||
           (patient.lungsScore && patient.lungsScore > 0) ||
           (patient.kidneyScore && patient.kidneyScore > 0);
  };

  const getOrganIconWithScore = (organ: 'brain' | 'heart' | 'lungs' | 'kidney', score?: number) => {
    // Don't render if score is 0 or undefined
    if (!score || score === 0) return null;
    
    const getColor = (score?: number) => {
      if (!score || score === 0) return 'text-gray-300';
      if (score === 1) return 'text-orange-400';
      if (score === 2) return 'text-orange-500';
      return 'text-red-500';
    };

    const getBgColor = (score?: number) => {
      if (!score || score === 0) return 'bg-gray-100';
      if (score === 1) return 'bg-orange-50';
      if (score === 2) return 'bg-orange-100';
      return 'bg-red-50';
    };

    const color = getColor(score);
    const bgColor = getBgColor(score);
    
    let IconComponent;
    switch (organ) {
      case 'brain':
        IconComponent = Brain;
        break;
      case 'heart':
        IconComponent = HeartIcon;
        break;
      case 'lungs':
        IconComponent = Wind;
        break;
      case 'kidney':
        IconComponent = Droplets;
        break;
    }

    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded ${bgColor}`}>
        {organ === 'heart' ? (
          <HeartIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} size={20} />
        ) : (
          <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
        )}
        <span className={`text-xs sm:text-sm font-semibold ${color}`}>
          {score}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {showTitle && (
        <h2 className="text-lg sm:text-xl font-medium text-primary">
          Patient Status {pedName}
        </h2>
      )}
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-200">
              <TableHead className="font-medium text-gray-700 text-xs sm:text-sm min-w-[150px]">Patient Informations</TableHead>
              <TableHead className="font-medium text-gray-700 text-xs sm:text-sm hidden sm:table-cell">Age</TableHead>
              <TableHead className="font-medium text-gray-700 text-xs sm:text-sm hidden md:table-cell">
                <div className="flex items-center gap-1">
                  #D PICU
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="font-medium text-gray-700 text-xs sm:text-sm">
                <div className="flex items-center gap-1">
                  PELOD
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="font-medium text-gray-700 text-xs sm:text-sm hidden lg:table-cell">Adherence</TableHead>
              <TableHead className="font-medium text-gray-700 text-xs sm:text-sm hidden xl:table-cell">Diagnosis</TableHead>
              <TableHead className="font-medium text-gray-700 text-xs sm:text-sm hidden xl:table-cell">Exams</TableHead>
              <TableHead className="font-medium text-gray-700 text-xs sm:text-sm">Alarms</TableHead>
              <TableHead className="font-medium text-gray-700 text-xs sm:text-sm hidden md:table-cell">Tour</TableHead>
              <TableHead className="hidden sm:table-cell"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient, index) => (
              <TableRow 
                key={patient.id}
                className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                onClick={() => navigate(`/optistats?patient=${patient.id}`)}
              >
                <TableCell className="py-3 sm:py-4">
                  <div className={`font-medium text-sm sm:text-base ${hasAlarms(patient) ? 'text-red-500' : 'text-gray-700'}`}>
                    {patient.id} {patient.name}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500">{patient.weight}</div>
                </TableCell>
                <TableCell className="text-gray-700 text-sm hidden sm:table-cell">{patient.age}</TableCell>
                <TableCell className="text-gray-700 text-sm hidden md:table-cell">{patient.picuId}</TableCell>
                <TableCell>
                  <span className="text-gray-700 text-sm">
                    {patient.pelodScore}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="font-medium text-sm text-gray-700">
                    {patient.adherence}%
                  </span>
                </TableCell>
                <TableCell className="text-gray-700 text-sm hidden xl:table-cell max-w-[200px] truncate">{patient.diagnosis}</TableCell>
                <TableCell className="hidden xl:table-cell">
                  {patient.exam && (
                    <span className="text-xs sm:text-sm text-gray-600">{patient.exam}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {patient.brainScore && patient.brainScore > 0 && getOrganIconWithScore('brain', patient.brainScore)}
                    {patient.heartScore && patient.heartScore > 0 && getOrganIconWithScore('heart', patient.heartScore)}
                    {patient.lungsScore && patient.lungsScore > 0 && getOrganIconWithScore('lungs', patient.lungsScore)}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {patient.tour && (
                    <Badge 
                      variant={patient.tour === 'Priority' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {patient.tour}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
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
    </div>
  );
};
