import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://zssyrupllztulugvibzh.supabase.co";
const supabaseAnonKey = "sb_publishable_JFU2Ysj_0R1ll_kh99y28A_Egygupbo";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
