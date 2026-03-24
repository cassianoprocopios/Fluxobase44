import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, role } = await req.json();

    if (!email || !role) {
      return Response.json({ error: 'Email and role are required' }, { status: 400 });
    }

    const roleLabels = {
      admin: 'Administrador',
      financeiro: 'Financeiro',
      gestor: 'Gestor',
      colaborador: 'Colaborador',
    };

    const subject = 'Convite para acessar o sistema de gestão financeira';
    const body = `Olá,

Você foi convidado para acessar o sistema de gestão financeira com o perfil de ${roleLabels[role] || role}.

Clique no link abaixo para fazer login:
${Deno.env.get('APP_URL') || 'https://seu-app.com'}/login

Essa é uma mensagem automática. Não responda a este e-mail.

Atenciosamente,
Sistema de Gestão Financeira`;

    await base44.integrations.Core.SendEmail({
      to: email,
      subject,
      body,
      from_name: 'Sistema Financeiro',
    });

    return Response.json({ success: true, message: `Email enviado para ${email}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});