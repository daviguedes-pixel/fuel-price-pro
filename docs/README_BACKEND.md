# Fuel Price Pro - Backend Setup

## 🚀 Configuração do Backend

Este projeto agora possui um backend seguro que gerencia todas as autenticações e operações de dados.

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Acesso ao Supabase (URL e Service Role Key)

## 🔧 Instalação

### 1. Instalar dependências do backend

```bash
cd server
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env` na pasta `server/` baseado no `env.example.txt`:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# JWT Secrets (MUDAR EM PRODUÇÃO!)
JWT_SECRET=sua-chave-secreta-jwt-muito-forte
JWT_REFRESH_SECRET=sua-chave-secreta-refresh-muito-forte

# Supabase Configuration
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

### 3. Configurar frontend

Crie um arquivo `.env` na raiz do projeto:

```env
# Frontend Configuration
VITE_API_URL=http://localhost:3001
```

## 🚦 Executando o Projeto

### Terminal 1 - Backend
```bash
cd server
npm run dev
```

### Terminal 2 - Frontend
```bash
npm run dev
```

## 🔐 Segurança Implementada

### 1. Autenticação JWT
- Tokens JWT com expiração curta (15 minutos)
- Refresh tokens de longa duração (7 dias)
- Cookies HTTP-only para armazenamento seguro
- Verificação de token em todas as rotas protegidas

### 2. Middleware de Segurança
- **Helmet**: Headers de segurança HTTP
- **CORS**: Configuração restritiva de cross-origin
- **Rate Limiting**: Limite de requisições por IP
- **Body Parser**: Limite de tamanho de payload

### 3. Supabase Seguro
- Service Role Key apenas no backend (nunca exposta no frontend)
- Client Anon Key movida para variáveis de ambiente
- Todas as operações de banco passam pelo backend

## 📁 Estrutura do Backend

```
server/
├── src/
│   ├── config/
│   │   └── supabase.ts       # Configuração Supabase
│   ├── controllers/
│   │   ├── authController.ts # Controle de autenticação
│   │   └── dataController.ts # Controle de dados
│   ├── middleware/
│   │   └── auth.ts            # Middleware de autenticação
│   ├── routes/
│   │   ├── auth.ts            # Rotas de autenticação
│   │   └── data.ts            # Rotas de dados
│   └── index.ts               # Servidor Express
├── .env                        # Variáveis de ambiente (NÃO COMITAR!)
└── package.json
```

## 🔌 API Endpoints

### Autenticação
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/check` - Verificar autenticação

### Dados (Protegidos)
- `GET /api/data/stations` - Obter estações
- `GET /api/data/clients` - Obter clientes
- `GET /api/data/payment-methods` - Obter métodos de pagamento
- `GET /api/data/price-requests` - Obter solicitações de preço
- `POST /api/data/price-requests` - Criar solicitação de preço

## 🚨 Migrações Necessárias

### Remover credenciais hardcoded

O arquivo `src/integrations/supabase/client.ts` foi atualizado para usar variáveis de ambiente. Agora é **DEPRECATED** e deve ser substituído pelo uso da API do backend.

### Atualizar componentes

Componentes que usam diretamente o Supabase devem ser atualizados para usar o cliente de API:

```typescript
// ❌ ANTIGO (Inseguro)
import { supabase } from '@/integrations/supabase/client';
const { data } = await supabase.from('table').select('*');

// ✅ NOVO (Seguro)
import { api } from '@/lib/api';
const { data } = await api.get('/api/data/endpoint');
```

## 🔒 Checklist de Segurança

- [x] Credenciais movidas para variáveis de ambiente
- [x] JWT implementado com tokens de acesso e refresh
- [x] Cookies HTTP-only para armazenamento seguro
- [x] Rate limiting aplicado
- [x] Helmet configurado
- [x] CORS configurado corretamente
- [x] Service Role Key apenas no backend
- [ ] Migrar componentes para usar API
- [ ] Adicionar testes de segurança

## 📝 Próximos Passos

1. Migrar componentes do frontend para usar o backend API
2. Adicionar validação de dados (Zod ou similar)
3. Implementar logging e monitoramento
4. Adicionar testes unitários e de integração
5. Configurar CI/CD para deploy automático
6. Adicionar documentação Swagger/OpenAPI
