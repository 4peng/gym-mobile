const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'expo-widgets', 'scripts', 'autolinking.rb');

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('options).resolve') && !content.includes('options).send(:resolve)')) {
    console.log('Patching expo-widgets autolinking.rb...');
    content = content.replace('options).resolve', 'options).send(:resolve)');
    fs.writeFileSync(filePath, content);
    console.log('Successfully patched expo-widgets.');
  } else {
    console.log('expo-widgets already patched or pattern not found.');
  }
} else {
  console.log('expo-widgets autolinking.rb not found at ' + filePath);
}
