import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Wind, Activity, ChevronLeft, ExternalLink } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { Patient, getPatientById } from '@/utils/patientData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PatientHeaderProps {
  currentPage: 'optistats' | 'optibrain' | 'optiheart' | 'optilungs';
}

export const PatientHeader = ({ currentPage }: PatientHeaderProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const patient = getPatientById(patientId);

  if (!patient) return null;

  const getOrganBadgeClass = (score?: number) => {
    if (!score || score === 0) return 'bg-gray-200 text-gray-600';
    if (score === 1) return 'bg-orange-100 text-orange-600 border border-orange-300';
    if (score === 2) return 'bg-orange-200 text-orange-700 border border-orange-400';
    return 'bg-red-200 text-red-700 border border-red-400';
  };

  const isActivePage = (page: string) => currentPage === page;

  return (
    <div className="bg-white border-b border-gray-200 mb-4 sm:mb-6">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-900 text-sm self-start"
            size="sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to patients
          </Button>

          <div className="flex items-center gap-2 sm:gap-4">
            <Select defaultValue="now">
              <SelectTrigger className="w-[100px] sm:w-[120px] bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white z-50">
                <SelectItem value="now">Now</SelectItem>
                <SelectItem value="3h">3h</SelectItem>
                <SelectItem value="6h">6h</SelectItem>
                <SelectItem value="12h">12h</SelectItem>
                <SelectItem value="24h">24h</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
              <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">UpToDate</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start justify-between gap-4 mb-3 sm:mb-4">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              {patient.id} {patient.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
              <span>{patient.age}</span>
              <span>•</span>
              <span>{patient.weight}</span>
              <span>•</span>
              <span>PICU: {patient.picuId}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-700 mt-2">
              <strong>Diagnosis:</strong> {patient.diagnosis}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2 w-full lg:w-auto">
            <div className="text-left sm:text-right sm:mr-4">
              <div className="text-xs text-gray-500 mb-1">PELOD Score</div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">{patient.pelodScore}</div>
            </div>

            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => navigate(`/optistats?patient=${patientId}`)}
                className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-xs font-semibold ${
                  isActivePage('optistats')
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Stats</span>
              </button>

              <button
                onClick={() => navigate(`/optibrain?patient=${patientId}`)}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  isActivePage('optibrain')
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Badge variant="outline" className={`${getOrganBadgeClass(patient.brainScore)} text-xs`}>
                  <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="ml-1 font-semibold">{patient.brainScore || 0}</span>
                </Badge>
              </button>

              <button
                onClick={() => navigate(`/optiheart?patient=${patientId}`)}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  isActivePage('optiheart')
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Badge variant="outline" className={`${getOrganBadgeClass(patient.heartScore)} text-xs`}>
                  <HeartIcon className="h-3 w-3 sm:h-4 sm:w-4" size={14} />
                  <span className="ml-1 font-semibold">{patient.heartScore || 0}</span>
                </Badge>
              </button>

              <button
                onClick={() => navigate(`/optilungs?patient=${patientId}`)}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  isActivePage('optilungs')
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Badge variant="outline" className={`${getOrganBadgeClass(patient.lungsScore)} text-xs`}>
                  <Wind className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="ml-1 font-semibold">{patient.lungsScore || 0}</span>
                </Badge>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
