import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem criar usuários' }, { status: 403 });
    }

    const { email, full_name, role } = await req.json();

    if (!email || !role) {
      return Response.json({ error: 'Email e perfil são obrigatórios' }, { status: 400 });
    }

    const newUser = await base44.asServiceRole.entities.User.create({
      email,
      full_name: full_name || '',
      role,
    });

    return Response.json({ 
      success: true, 
      user: newUser,
      message: `Usuário ${email} criado com sucesso` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});