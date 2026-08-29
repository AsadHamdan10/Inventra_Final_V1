
import re

with open("backend/test_phase_6_1_onboarding_security.js", "r") as f:
    data = f.read()

new_tests = """
    // 31. Password Policy Tests
    const { activateAccount } = require("./src/controllers/authController");
    
    async function testPolicy(pwd) {
      return new Promise((resolve) => {
        const req = { body: { token: rawToken, password: pwd } };
        const res = {
          status: (code) => ({
            json: (body) => resolve({ code, body })
          })
        };
        activateAccount(req, res, (err) => resolve({ code: 500, body: err }));
      });
    }

    // 1. 7-character password fails
    let res = await testPolicy("Short1!");
    assert.strictEqual(res.code, 400);
    assert.ok(res.body.message.includes("least 8 characters"));

    // 3. Missing uppercase fails
    res = await testPolicy("noupper123!");
    assert.strictEqual(res.code, 400);
    assert.ok(res.body.message.includes("uppercase"));

    // 4. Missing lowercase fails
    res = await testPolicy("NOLOWER123!");
    assert.strictEqual(res.code, 400);
    assert.ok(res.body.message.includes("lowercase"));

    // 5. Missing number fails
    res = await testPolicy("NoNumber!");
    assert.strictEqual(res.code, 400);
    assert.ok(res.body.message.includes("number"));

    // 6. Missing special character fails
    res = await testPolicy("NoSpecial123");
    assert.strictEqual(res.code, 400);
    assert.ok(res.body.message.includes("special character"));

    // 7. Password containing spaces fails
    res = await testPolicy("Has Space123!");
    assert.strictEqual(res.code, 400);
    assert.ok(res.body.message.includes("spaces"));

    // 8. Password equal to username fails
    res = await testPolicy(testUser.username); // usually doesnt meet complexity, but if it did
    assert.strictEqual(res.code, 400);
    // Might fail for complexity first, so lets mock a valid-looking username
    let tempUser = await prisma.user.update({ where: { id: testUser.id }, data: { username: "User123!", email: "UserEmail123!@test.com" } });
    res = await testPolicy("User123!");
    assert.strictEqual(res.code, 400);
    assert.ok(res.body.message.includes("username"));

    // 9. Password equal to email fails
    res = await testPolicy("UserEmail123!@test.com");
    assert.strictEqual(res.code, 400);
    assert.ok(res.body.message.includes("email"));

    // 2. 8-character compliant password succeeds
    // We will do a full success activation with a valid password
    res = await testPolicy("ValidPass123!");
    assert.strictEqual(res.code, 200, "Should succeed with valid 8+ char password");
    console.log("? Password policy assertions passed.");
"""

# We need to insert this BEFORE the manual activation logic simulation
data = data.replace("""    // 14-16. Activation logic simulation""", new_tests + """\n    // 14-16. Activation logic simulation""")
# Remove the old manual activation transaction since the testPolicy("ValidPass123!") will ACTUALLY activate the user in DB
data = data.replace("""    await prisma.$transaction([""", """    /* await prisma.$transaction([""")
data = data.replace("""prisma.activationToken.update({ where: { id: dbToken.id }, data: { usedAt: new Date() } })
    ]);""", """prisma.activationToken.update({ where: { id: dbToken.id }, data: { usedAt: new Date() } })
    ]); */""")

with open("backend/test_phase_6_1_onboarding_security.js", "w") as f:
    f.write(data)

