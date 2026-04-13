// Check MongoDB database status
require("dotenv").config();
const { MongoClient } = require("mongodb");

async function checkDatabase() {
  const MONGO_URI =
    "mongodb+srv://mohdsabir24bcy66_db_user:EcfoGRBk9fwa4U47@cluster0.hefvmrz.mongodb.net/?appName=Cluster0";
  const DB_NAME = "secure_exam";
  const COLLECTION_NAME = "User Data";

  let client;

  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log("✓ Connected to MongoDB");

    const database = client.db(DB_NAME);
    console.log(`\n✓ Database: ${DB_NAME}`);

    // List all collections
    const collections = await database.listCollections().toArray();
    console.log(`\n✓ Collections in database:`);
    collections.forEach((col) => {
      console.log(`  - ${col.name}`);
    });

    // Check User Data collection
    const userCollection = database.collection(COLLECTION_NAME);
    const userData = await userCollection.findOne({ _id: "users_data" });

    console.log(`\n--- "User Data" Collection Status ---`);
    if (!userData) {
      console.log("⚠️  No document found with _id: 'users_data'");
      return;
    }

    console.log("✓ Document found");
    console.log(`  Faculty count: ${userData.faculty?.length || 0}`);
    console.log(`  Students count: ${userData.students?.length || 0}`);

    if (userData.faculty && userData.faculty.length > 0) {
      console.log("\n✓ Faculty members:");
      userData.faculty.forEach((f, idx) => {
        console.log(`  ${idx + 1}. ${f.name} (${f.email})`);
      });
    } else {
      console.log("\n⚠️  Faculty array is EMPTY or missing");
      console.log("   Document structure:", JSON.stringify(userData, null, 2));
    }

    if (userData.students && userData.students.length > 0) {
      console.log(`\n✓ Student members (showing first 5):`);
      userData.students.slice(0, 5).forEach((s, idx) => {
        console.log(`  ${idx + 1}. ${s.name} (${s.email})`);
      });
      if (userData.students.length > 5) {
        console.log(`  ... and ${userData.students.length - 5} more`);
      }
    }

    console.log("\n--- Summary ---");
    console.log(
      `Total users: ${(userData.students?.length || 0) + (userData.faculty?.length || 0)}`,
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkDatabase();
