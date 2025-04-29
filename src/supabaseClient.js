import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dqriwrivxwnlcjdikgfk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxcml3cml2eHdubGNqZGlrZ2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MjAwOTgsImV4cCI6MjA2MDk5NjA5OH0.tkdtiR_w6Gvg2XEN8Q6fDJa-iQcpgPtYt0uDOnKA3aU'

export const supabase = createClient(supabaseUrl, supabaseKey) 