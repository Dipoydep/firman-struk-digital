import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. POST (Bikin Struk)
  if (req.method === 'POST') {
    try {
      const { buyer_name, items } = req.body;
      if (!items || items.length === 0) return res.status(400).json({ error: "Data kosong" });

      const time = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();
      const receipt_id = `FRM-${time}-${random}`;
      const total_amount = items.reduce((sum, item) => sum + (item.qty * item.price), 0);

      const { data, error } = await supabase
        .from('receipts')
        .insert([{ receipt_id, buyer_name: buyer_name || 'Pelanggan', items, total_amount, status: 'PENDING' }])
        .select();

      if (error) throw error;
      return res.status(200).json({ message: 'Struk dibuat', receipt_id, total_amount, data: data[0] });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // 2. GET (Ambil Data - Bisa untuk Admin atau Buyer)
  if (req.method === 'GET') {
    const clientPassword = req.headers['x-admin-password'];
    const { ids } = req.query; // Menangkap parameter ?ids=FRM-123,FRM-456

    try {
      // Kalau yang minta adalah ADMIN (bawa password)
      if (clientPassword === ADMIN_PASSWORD) {
        const { data, error } = await supabase.from('receipts').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json(data);
      }

      // Kalau yang minta adalah BUYER (bawa ID struk)
      if (ids) {
        const idArray = ids.split(',');
        const { data, error } = await supabase
          .from('receipts')
          .select('receipt_id, status') // Cuma butuh ID dan status
          .in('receipt_id', idArray);
        if (error) throw error;
        return res.status(200).json(data);
      }

      return res.status(401).json({ error: 'Akses Ditolak!' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // 3. PATCH (Konfirmasi Admin)
  if (req.method === 'PATCH') {
    const clientPassword = req.headers['x-admin-password'];
    if (clientPassword !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Akses Ditolak!' });

    try {
      const { receipt_id, new_status } = req.body;
      const { data, error } = await supabase.from('receipts').update({ status: new_status }).eq('receipt_id', receipt_id).select();
      if (error) throw error;
      return res.status(200).json({ message: 'Status diupdate', data });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // 4. DELETE (Hapus Admin)
  if (req.method === 'DELETE') {
    const clientPassword = req.headers['x-admin-password'];
    if (clientPassword !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Akses Ditolak!' });

    try {
      const { receipt_id } = req.body;
      const { error } = await supabase.from('receipts').delete().eq('receipt_id', receipt_id);
      if (error) throw error;
      return res.status(200).json({ message: 'Struk dihapus' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method tidak diizinkan' });
}
