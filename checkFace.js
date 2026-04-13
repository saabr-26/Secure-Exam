const { MongoClient } = require('mongodb');
const MONGO_URI = "mongodb+srv://mohdsabir24bcy66_db_user:EcfoGRBk9fwa4U47@cluster0.hefvmrz.mongodb.net/?appName=Cluster0";
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('secure_exam');
  const c = db.collection('User Data');
  const user = await c.findOne({ _id: "users_data" });
  if (user && user.students.length > 0) {
    for (let i = user.students.length - 1; i >= Math.max(0, user.students.length - 5); i--) {
      const student = user.students[i];
      console.log(`Student [${Math.max(1, i)}]: ${student.name}`);
      console.log(`Descriptor type:`, typeof student.faceDescriptor);
      console.log(`Is array?`, Array.isArray(student.faceDescriptor));
      if (student.faceDescriptor && student.faceDescriptor.length > 0) {
         const distance = euclideanDistance(student.faceDescriptor, student.faceDescriptor); // to check NaN
         console.log(`  Length:`, student.faceDescriptor.length);
         console.log(`  Element 0:`, typeof student.faceDescriptor[0]);
      }
    }
  } else {
    console.log("No students");
  }
  await client.close();
}
function euclideanDistance(desc1, desc2) {
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += Math.pow(desc1[i] - desc2[i], 2);
  }
  return Math.sqrt(sum);
}

main().catch(console.error);
