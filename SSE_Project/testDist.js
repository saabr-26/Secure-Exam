const { MongoClient } = require('mongodb');
const MONGO_URI = "mongodb+srv://mohdsabir24bcy66_db_user:EcfoGRBk9fwa4U47@cluster0.hefvmrz.mongodb.net/?appName=Cluster0";
function euclideanDistance(desc1, desc2) {
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += Math.pow(desc1[i] - desc2[i], 2);
  }
  return Math.sqrt(sum);
}
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('secure_exam');
  const c = db.collection('User Data');
  const user = await c.findOne({ _id: "users_data" });
  if (user) {
      const arrStudents = user.students.filter(s => Array.isArray(s.faceDescriptor));
      console.log(`Found ${arrStudents.length} students with valid arrays.`);
      for (let i=0; i<arrStudents.length; i++) {
        for (let j=i+1; j<arrStudents.length; j++) {
            console.log(`Distance ${arrStudents[i].name} vs ${arrStudents[j].name}:`, euclideanDistance(arrStudents[i].faceDescriptor, arrStudents[j].faceDescriptor));
        }
      }
  }
  await client.close();
}
main().catch(console.error);
