// Script para validar Service Account JSON antes de colar no Supabase
// Execute: node scripts/validar-service-account.js

const fs = require('fs');
const path = require('path');

// Caminho do arquivo JSON (ajuste se necessário)
const jsonPath = process.argv[2] || './firebase-service-account.json';

console.log('🔍 Validando Service Account JSON...\n');

try {
  // Ler arquivo
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ Arquivo não encontrado:', jsonPath);
    console.log('\n💡 Dica: Passe o caminho do arquivo como argumento:');
    console.log('   node scripts/validar-service-account.js caminho/para/arquivo.json');
    process.exit(1);
  }

  const fileContent = fs.readFileSync(jsonPath, 'utf8');
  const serviceAccount = JSON.parse(fileContent);

  console.log('✅ JSON válido!\n');

  // Validar campos obrigatórios
  const requiredFields = [
    'type',
    'project_id',
    'private_key_id',
    'private_key',
    'client_email',
    'client_id',
    'auth_uri',
    'token_uri',
    'auth_provider_x509_cert_url',
    'client_x509_cert_url'
  ];

  console.log('📋 Campos obrigatórios:');
  let allValid = true;
  
  requiredFields.forEach(field => {
    if (serviceAccount[field]) {
      if (field === 'private_key') {
        const hasBegin = serviceAccount[field].includes('BEGIN PRIVATE KEY');
        const hasEnd = serviceAccount[field].includes('END PRIVATE KEY');
        if (hasBegin && hasEnd) {
          console.log(`   ✅ ${field}: OK (${serviceAccount[field].length} caracteres)`);
        } else {
          console.log(`   ❌ ${field}: Formato inválido (falta BEGIN/END PRIVATE KEY)`);
          allValid = false;
        }
      } else {
        console.log(`   ✅ ${field}: OK`);
      }
    } else {
      console.log(`   ❌ ${field}: FALTANDO`);
      allValid = false;
    }
  });

  console.log('\n📋 Informações do Service Account:');
  console.log(`   Project ID: ${serviceAccount.project_id || 'N/A'}`);
  console.log(`   Client Email: ${serviceAccount.client_email || 'N/A'}`);
  console.log(`   Type: ${serviceAccount.type || 'N/A'}`);

  if (allValid) {
    console.log('\n✅✅✅ Service Account JSON está válido e pronto para usar! ✅✅✅');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Copie TODO o conteúdo deste arquivo JSON');
    console.log('   2. Vá em: Supabase Dashboard > Edge Functions > Settings > Secrets');
    console.log('   3. Adicione/Edite: FIREBASE_SERVICE_ACCOUNT_JSON');
    console.log('   4. Cole o JSON completo');
    console.log('   5. Salve');
    console.log('   6. Teste enviando uma notificação!');
  } else {
    console.log('\n❌ Service Account JSON está incompleto ou inválido!');
    console.log('   Verifique se você baixou o arquivo completo do Firebase.');
    process.exit(1);
  }

} catch (error) {
  console.error('\n❌ Erro ao validar JSON:');
  console.error('   Mensagem:', error.message);
  
  if (error.message.includes('JSON')) {
    console.error('\n💡 O arquivo pode estar corrompido ou mal formatado.');
    console.error('   Tente baixar novamente do Firebase Console.');
  }
  
  process.exit(1);
}

