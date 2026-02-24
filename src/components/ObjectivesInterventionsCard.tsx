import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Check, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { usePatientObjectives } from '@/hooks/usePatientObjectives';

interface ObjectivesInterventionsCardProps {
  patientId: string;
  organ: 'brain' | 'heart' | 'lungs';
}

export const ObjectivesInterventionsCard = ({ patientId, organ }: ObjectivesInterventionsCardProps) => {
  const {
    objectives,
    interventions,
    isLoading,
    saveObjectives,
    saveInterventions,
    isSaving,
  } = usePatientObjectives(patientId, organ);

  const [isEditingObjectives, setIsEditingObjectives] = useState(false);
  const [editedObjectives, setEditedObjectives] = useState<string[]>([]);
  const [isEditingInterventions, setIsEditingInterventions] = useState(false);
  const [editedInterventions, setEditedInterventions] = useState<string[]>([]);

  const handleSaveObjectives = () => {
    const filtered = editedObjectives.filter(o => o.trim() !== '');
    saveObjectives(filtered);
    setIsEditingObjectives(false);
  };

  const handleSaveInterventions = () => {
    const filtered = editedInterventions.filter(i => i.trim() !== '');
    saveInterventions(filtered);
    setIsEditingInterventions(false);
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Objectifs & Interventions</CardTitle>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Objectives Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm text-foreground">Objectifs Actuels:</h4>
            {!isEditingObjectives ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditedObjectives([...objectives]);
                  setIsEditingObjectives(true);
                }}
                className="h-8 gap-1"
              >
                <Edit2 className="h-3 w-3" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveObjectives}
                  className="h-8 gap-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                >
                  <Check className="h-3 w-3" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditingObjectives(false);
                    setEditedObjectives([]);
                  }}
                  className="h-8 gap-1 text-destructive hover:text-destructive/80"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {!isEditingObjectives ? (
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {objectives.map((objective, index) => (
                <li key={index}>{objective}</li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              {editedObjectives.map((objective, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={objective}
                    onChange={(e) => {
                      const newObjectives = [...editedObjectives];
                      newObjectives[index] = e.target.value;
                      setEditedObjectives(newObjectives);
                    }}
                    className="text-sm"
                    placeholder="Enter objective..."
                    maxLength={500}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newObjectives = editedObjectives.filter((_, i) => i !== index);
                      setEditedObjectives(newObjectives);
                    }}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditedObjectives([...editedObjectives, ''])}
                className="h-8 gap-1 text-sm"
              >
                <Plus className="h-3 w-3" />
                Add Objective
              </Button>
            </div>
          )}
        </div>

        {/* Interventions Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm text-foreground">Interventions Récentes:</h4>
            {!isEditingInterventions ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditedInterventions([...interventions]);
                  setIsEditingInterventions(true);
                }}
                className="h-8 gap-1"
              >
                <Edit2 className="h-3 w-3" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveInterventions}
                  className="h-8 gap-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                >
                  <Check className="h-3 w-3" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditingInterventions(false);
                    setEditedInterventions([]);
                  }}
                  className="h-8 gap-1 text-destructive hover:text-destructive/80"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {!isEditingInterventions ? (
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {interventions.map((intervention, index) => (
                <li key={index}>{intervention}</li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              {editedInterventions.map((intervention, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={intervention}
                    onChange={(e) => {
                      const newInterventions = [...editedInterventions];
                      newInterventions[index] = e.target.value;
                      setEditedInterventions(newInterventions);
                    }}
                    className="text-sm"
                    placeholder="Enter intervention..."
                    maxLength={500}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newInterventions = editedInterventions.filter((_, i) => i !== index);
                      setEditedInterventions(newInterventions);
                    }}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditedInterventions([...editedInterventions, ''])}
                className="h-8 gap-1 text-sm"
              >
                <Plus className="h-3 w-3" />
                Add Intervention
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
