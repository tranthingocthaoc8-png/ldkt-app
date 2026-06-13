const SHEET_API_URL =
  'https://script.google.com/macros/s/AKfycbwXSN2IzDrARnWm7rXOnFqqiKiO6xZynK4yVCtvkqHtWgI59M7bnIlrbNGhhP-McoUzIw/exec';

export const dynamic = 'force-dynamic';

async function callSheet(options = {}) {
  const res = await fetch(SHEET_API_URL, {
    ...options,
    cache: 'no-store',
    redirect: 'follow'
  });

  const text = await res.text();

  if (text.trim().startsWith('<')) {
    return Response.json(
      {
        ok: false,
        error: 'Apps Script trả về HTML, không phải JSON. Hãy kiểm tra quyền Web App: Execute as Me, Who has access Anyone.'
      },
      { status: 500 }
    );
  }

  return new Response(text, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function GET() {
  return callSheet({ method: 'GET' });
}

export async function POST(request) {
  const body = await request.text();

  return callSheet({
    method: 'POST',
    headers: {
      'content-type': 'text/plain;charset=utf-8'
    },
    body
  });
}
