# Changelog - Upgrade de Segurança

## [2.0.0] - 2024-10-25

### 🚀 Adicionado

#### Backend Seguro
- ✅ Servidor Express.js com TypeScript
- ✅ Autenticação JWT com tokens de acesso e refresh
- ✅ Middleware de segurança (Helmet, CORS, Rate Limiting)
- ✅ Cookies HTTP-only para armazenamento seguro
- ✅ Sistema de roteamento modular
- ✅ Controllers para autenticação e dados
- ✅ Sistema de validação de dados com express-validator

#### Segurança
- ✅ Credenciais movidas para variáveis de ambiente
- ✅ Service Role Key isolada no backend
- ✅ Sistema de autenticação centralizado
- ✅ Rate limiting (100 requisições/15min por IP)
- ✅ Headers de segurança configurados
- ✅ Proteção CSRF com same-site cookies

#### Frontend
- ✅ Cliente API (`src/lib/api.ts`)
- ✅ Hook de autenticação backend (`useApiAuth.ts`)
- ✅ Configuração de variáveis de ambiente
- ✅ Cliente Supabase deprecated com avisos de segurança

#### Documentação
- ✅ `README_BACKEND.md` - Documentação do backend
- ✅ `SETUP_BACKEND.md` - Guia completo de configuração
- ✅ `SECURITY_UPGRADE_SUMMARY.md` - Resumo das mudanças
- ✅ `CHANGELOG.md` - Este arquivo

### 🔄 Modificado

#### Arquitetura
- ⚠️ Cliente Supabase deprecated (usar backend API agora)
- 🔧 Credenciais hardcoded removidas
- 🔧 Estrutura de autenticação refatorada

#### Arquivos
- ✅ `src/integrations/supabase/client.ts` - Credenciais movidas para env vars
- ✅ `package.json` - Scripts de backend adicionados
- ✅ Estrutura de pastas organizada

### 🗑️ Removido

#### Arquivos Temporários
- ❌ 46 arquivos .sql de debug/teste removidos:
  - `debug_*.sql`
  - `check_*.sql`
  - `test_*.sql`
  - `verificar_*.sql`
  - `fix_*.sql`
  - `create_*.sql`
  - `apply_*.sql`
  - E outros arquivos temporários

### 🔒 Segurança

#### Antes
- ❌ Credenciais Supabase hardcoded no frontend
- ❌ Service Role Key exposta no código
- ❌ Sem controle de autenticação centralizado
- ❌ Vulnerável a ataques

#### Depois
- ✅ Credenciais em variáveis de ambiente
- ✅ Service Role Key apenas no backend
- ✅ Autenticação JWT centralizada
- ✅ Rate limiting implementado
- ✅ Cookies HTTP-only
- ✅ Headers de segurança configurados

### 📋 Próximos Passos

- [ ] Migrar componentes para usar backend API
- [ ] Remover uso direto do Supabase no frontend
- [ ] Adicionar testes de segurança
- [ ] Configurar CI/CD
- [ ] Documentação Swagger/OpenAPI

### 📖 Como Usar

#### Instalação
```bash
npm install
npm run backend:install
```

#### Configuração
```bash
# Backend
cp server/env.example.txt server/.env
# Editar server/.env com credenciais Supabase

# Frontend
cp .env.example .env
# Configurar VITE_API_URL
```

#### Executar
```bash
# Backend + Frontend juntos
npm run dev:full

# Ou separadamente
npm run backend:dev  # Terminal 1
npm run dev          # Terminal 2
```

---

**Nota**: Este changelog documenta as mudanças de segurança implementadas na versão 2.0.0.
