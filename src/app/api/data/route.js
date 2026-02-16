import { fetchSheetData, processData, filterRowsByProduct, computeProductsList } from '@/lib/sheets';
import { NextResponse } from 'next/server';

// Cache data for 1 hour (ISR-style)
export const revalidate = 3600;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const product = searchParams.get('product');

    let rows = await fetchSheetData();

    if (from) rows = rows.filter(r => r['Date'] >= from);
    if (to) rows = rows.filter(r => r['Date'] <= to);

    // Preserve the full product list before narrowing by product filter
    const allProducts = computeProductsList(rows);

    if (product) rows = filterRowsByProduct(rows, product);

    const data = processData(rows);
    data.products = allProducts;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch sheet data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error.message },
      { status: 500 }
    );
  }
}
