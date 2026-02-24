
-- Insert PED A patients
INSERT INTO public.patients (id, name, age, weight, picu_id, pelod_score, adherence, diagnosis, exam, priority, tour, brain_score, heart_score, lungs_score, kidney_score, ward)
VALUES
  ('#8749', 'John Doe (M)', '6y 3m 20d', '15.5 kg', 'D1', 28, 65, 'Traumatisme crânien avec hypertension intracrânienne', 'CT SCAN, EEG', 'Élevée', 'Prioritaire', 3, 2, 1, 0, 'pedA'),
  ('#25', 'Dave, Alex (M)', '4y 4m 12d', '15.6 kg', 'D2', 30, 56, 'Traumatisme crânien', 'CT SCAN', 'Élevée', 'Prioritaire', 3, 2, 0, 0, 'pedA'),
  ('#23', 'Brassel, Benjamin (M)', '10d', '4.5 kg', 'D3', 18, 70, 'Syndrome de détresse respiratoire', 'Radio thoracique', 'Moyenne', NULL, 0, 1, 3, 1, 'pedA'),
  ('#24', 'Gagnon, Eli (F)', '3y 4m 12d', '14.8 kg', 'D5', 17, 74, 'Pneumonie sévère avec complications', 'CT Thorax', 'Moyenne', NULL, 2, 1, 2, 0, 'pedA'),
  ('#22', 'Bureaux, Charlotte (F)', '12d', '3.5 kg', 'D3', 17, 78, 'Convulsions néonatales', 'CT SCAN, EEG', 'Moyenne', NULL, 3, 0, 0, 0, 'pedA'),
  ('#21', 'Dagenais, Etienne (M)', '7y 2m 6d', '24.3 kg', 'D2', 12, 89, 'Post-op Adéno-Amygdalectomie', '', 'Faible', NULL, 0, 0, 1, 0, 'pedA'),
  ('#6312', 'Jules Moreault (M)', '9y 11m 18d', '32.3 kg', 'D6', 24, 72, 'Traumatisme crânien', 'EEG continu, IRM', 'Élevée', 'Prioritaire', 3, 1, 2, 1, 'pedA'),
  ('#16', 'Ibrahim, Hakim (M)', '5y', '19.2 kg', 'D113', 9, 71, 'Cardiomyopathie dilatée', 'ECHO, ECG', 'Faible', NULL, 0, 3, 1, 0, 'pedA'),
  ('#8448', 'John Doe (M)', '6y 3m 20d', '22.0 kg', 'D7', 26, 68, 'Traumatisme crânien avec hypertension intracrânienne', 'CT SCAN, EEG', 'Élevée', 'Prioritaire', 3, 2, 1, 0, 'pedA'),
  -- PED B patients
  ('#4', 'Brown, Sophia (F)', '4y 6m 12d', '15.5 kg', 'B1', 28, 72, 'Traumatisme crânien sévère avec hémorragie intracrânienne', 'IRM, CT Scan', 'Élevée', NULL, 3, 2, 1, 0, 'pedB'),
  ('#5', 'Davis, Liam (M)', '6y 1m 8d', '20.1 kg', 'B2', 22, 80, 'Soins post-chirurgie cardiaque', 'ECHO, ECG', 'Moyenne', NULL, 0, 3, 1, 0, 'pedB'),
  ('#6', 'Wilson, Emma (F)', '8m 20d', '8.2 kg', 'B3', 20, 75, 'Bronchiolite avec insuffisance respiratoire', 'Radio thoracique', 'Moyenne', NULL, 0, 1, 3, 0, 'pedB'),
  ('#7', 'Taylor, Noah (M)', '1y 3m', '10.5 kg', 'B4', 16, 85, 'Méningite', 'Ponction lombaire, CT Scan', 'Moyenne', NULL, 2, 0, 0, 1, 'pedB'),
  ('#9', 'Anderson, Mia (F)', '5y 7m', '18.3 kg', 'B5', 12, 88, 'Insuffisance rénale aiguë', 'Échographie rénale', 'Faible', NULL, 0, 1, 0, 3, 'pedB');
