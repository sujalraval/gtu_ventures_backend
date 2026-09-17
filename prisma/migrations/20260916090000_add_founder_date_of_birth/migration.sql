-- Date of birth moved out of Form A along with the rest of the founder
-- details. ApplicationFounder already held every other one — designation,
-- Aadhaar, gender, education, institution — but not this, so it is the only
-- founder field Form B could not capture.
--
-- Per founder rather than one per application: Form B collects a team, and a
-- co-founder's date of birth is as relevant as the lead founder's. submitFormB
-- copies the first founder's value to StartupApplication.dob so that column
-- keeps its existing meaning.

ALTER TABLE "ApplicationFounder"
  ADD COLUMN "dateOfBirth" TIMESTAMP(3);
