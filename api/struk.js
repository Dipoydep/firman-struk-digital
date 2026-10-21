import { createClient } from '@supabase/supabase-js';

// Kunci ini bakal diambil dari Environment Variables Vercel
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Password Admin (Nanti kita atur di Vercel)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  // Setup CORS biar GitHub Pages bisa akses Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ==========================================
  // 1. LOGIKA BUAT STRUK BARU (METHOD POST)
  // ==========================================
  if (req.method === 'POST') {
    try {
      const { buyer_name, items } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "Data barang kosong" });
      }

      // Bikin kode unik FRM-xxxx
      const time = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();
      const receipt_id = `FRM-${time}-${random}`;

      // Hitung total di server (anti manipulasi)
      const total_amount = items.reduce((sum, item) => sum + (item.qty * item.price), 0);

      // Simpan ke Supabase
      const { data, error } = await supabase
        .from('receipts')
        .insert([{ 
          receipt_id: receipt_id, 
          buyer_name: buyer_name || 'Pelanggan', 
          items: items, 
          total_amount: total_amount,
          status: 'PENDING'
        }])
        .select();

      if (error) throw error;

      // Balikin data ke Frontend
      return res.status(200).json({
        message: 'Struk berhasil dibuat',
        receipt_id: receipt_id,
        total_amount: total_amount,
        data: data[0]
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ==========================================
  // 2. LOGIKA ADMIN LIHAT DAFTAR STRUK (METHOD GET)
  // ==========================================
  if (req.method === 'GET') {
    // Cek Password Admin
    const clientPassword = req.headers['x-admin-password'];
    if (clientPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Akses Ditolak! Password Salah.' });
    }

    try {
      // Ambil semua struk, urutkan dari yang paling baru
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ==========================================
  // 3. LOGIKA KONFIRMASI ADMIN (METHOD PATCH)
  // ==========================================
  if (req.method === 'PATCH') {
    // Cek Password Admin
    const clientPassword = req.headers['x-admin-password'];
    if (clientPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Akses Ditolak!' });
    }

    try {
      const { receipt_id, new_status } = req.body; // CONFIRMED atau REJECTED

      if (!receipt_id || !new_status) {
        return res.status(400).json({ error: 'Data tidak lengkap' });
      }

      // Update status di Supabase
      const { data, error } = await supabase
        .from('receipts')
        .update({ status: new_status })
        .eq('receipt_id', receipt_id)
        .select();

      if (error) throw error;
      return res.status(200).json({ message: 'Status berhasil diupdate', data });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method tidak diizinkan' });
}
