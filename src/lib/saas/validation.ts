import { NextResponse } from 'next/server';
import { z } from 'zod';

export function badRequestFromZod(error: z.ZodError) {
  return NextResponse.json(
    {
      error: 'Invalid request',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    { status: 400 }
  );
}
