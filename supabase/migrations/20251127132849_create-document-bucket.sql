-- Create the 'documents' storage bucket (private by default)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 52428800);  -- 50MB limit, adjust as needed