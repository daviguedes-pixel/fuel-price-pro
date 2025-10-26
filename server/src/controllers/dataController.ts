import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

export async function getStations(req: Request, res: Response) {
  try {
    const { data, error } = await supabaseAdmin
      .from('stations')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Get stations error:', error);
    res.status(500).json({ message: 'Error fetching stations' });
  }
}

export async function getClients(req: Request, res: Response) {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Get clients error:', error);
    res.status(500).json({ message: 'Error fetching clients' });
  }
}

export async function getPaymentMethods(req: Request, res: Response) {
  try {
    const { stationId } = req.query;

    let query = supabaseAdmin.from('tipos_pagamento').select('*');

    if (stationId) {
      query = query.eq('id_posto', stationId);
    }

    const { data, error } = await query.order('cartao');

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ message: 'Error fetching payment methods' });
  }
}

export async function getPriceRequests(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { data, error } = await supabaseAdmin
      .from('price_requests')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Get price requests error:', error);
    res.status(500).json({ message: 'Error fetching price requests' });
  }
}

export async function createPriceRequest(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
      station_id,
      client_id,
      product,
      current_price,
      suggested_price,
      payment_method_id,
      observations,
    } = req.body;

    const { data, error } = await supabaseAdmin
      .from('price_requests')
      .insert({
        station_id,
        client_id,
        product,
        current_price,
        suggested_price,
        payment_method_id,
        observations,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data });
  } catch (error: any) {
    console.error('Create price request error:', error);
    res.status(500).json({ message: 'Error creating price request' });
  }
}
