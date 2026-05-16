import { DB } from "./core/db.js";
import { MySqlDriver } from "./drivers/mysql.driver.js";
import { Employee } from "./entities/employee.entity.js";
import { User } from "./entities/user.entity.js";
import { PostgreSqlDriver } from "./drivers/postgresql.driver.js";

// DB.setDriver(
//   new MySqlDriver({
//     host: "localhost",
//     port: 3306,
//     user: "user",
//     password: "user_password",
//     database: "orm_db",
//   }),
// );

DB.setDriver(
  new PostgreSqlDriver("postgres://user:user_password@localhost:5432/orm_db"),
);

async function bootstrap(): Promise<void> {
  try {
    await DB.driver.connect();
    console.log("Connected to database");

    const user1 = new User({
      name: "John Doe",
      address: "Bangalore",
      dob: new Date("1990-01-01"),
      email: "john1@example.com",
      createdAt: new Date(),
      createdBy: 1,
      updatedAt: new Date(),
      updatedBy: 1,
    });

    const user2 = new User({
      name: "Jane Smith",
      address: "Mysore",
      dob: new Date("1992-05-10"),
      email: "jane@example.com",
      createdAt: new Date(),
      createdBy: 1,
      updatedAt: new Date(),
      updatedBy: 1,
    });

    const user3 = new User({
      name: "Mike Ross",
      address: "Chennai",
      dob: new Date("1995-08-20"),
      email: "mike@example.com",
      createdAt: new Date(),
      createdBy: 2,
      updatedAt: new Date(),
      updatedBy: 2,
    });

    await user1.save();
    await user2.save();
    await user3.save();

    const foundUser = await User.findById(1);
    console.log("findById:", foundUser);

    const oneUser = await User.findOne({
      email: "john1@example.com ",
    });
    console.log("findOne:", oneUser);

    const allUsers = await User.findAll();
    console.log("findAll:", allUsers);

    const filteredUsers = await User.findAll({
      conditions: {
        createdBy: 1,
      },
    });
    console.log("findAll with conditions:", filteredUsers);

    const pagedUsers = await User.findAll({
      limit: 2,
      offset: 0,
    });
    console.log("findAll pagination:", pagedUsers);

    const totalUsers = await User.count();
    console.log("count all:", totalUsers);

    const countFiltered = await User.count({
      createdBy: 1,
    });
    console.log("count filtered:", countFiltered);

    const updated = await User.updateById(1, {
      address: "New Address Bangalore",
      updatedAt: new Date(),
    });
    console.log("updateById:", updated);

    const updateMany = await User.updateAll(
      {
        updatedBy: 99,
      },
      {
        createdBy: 1,
      },
    );
    console.log("updateAll:", updateMany);

    const deletedOne = await User.deleteById(1);
    console.log("deleteById:", deletedOne);

    const deletedCond = await User.deleteOne({
      email: "jane@example.com",
    });
    console.log("deleteOne:", deletedCond);

    const deletedMany = await User.deleteAll({
      conditions: {
        createdBy: 1,
      },
    });
    console.log("deleteAll:", deletedMany);

    const employee1 = new Employee({
      name: "Rahul Sharma",
      position: "Software Engineer",
      department: "Engineering",
      salary: 75000,
      createdAt: new Date(),
      createdBy: 1,
      updatedAt: new Date(),
      updatedBy: 1,
    });

    const employee2 = new Employee({
      name: "Priya Nair",
      position: "HR Manager",
      department: "Human Resources",
      salary: 68000,
      createdAt: new Date(),
      createdBy: 1,
      updatedAt: new Date(),
      updatedBy: 1,
    });

    const employee3 = new Employee({
      name: "Arjun Reddy",
      position: "Accountant",
      department: "Finance",
      salary: 62000,
      createdAt: new Date(),
      createdBy: 2,
      updatedAt: new Date(),
      updatedBy: 2,
    });

    await employee1.save();
    await employee2.save();
    await employee3.save();

    const foundEmployee = await Employee.findById(1);
    console.log("findById:", foundEmployee);

    const oneEmployee = await Employee.findOne({
      name: "Rahul Sharma",
    });
    console.log("findOne:", oneEmployee);

    const allEmployees = await Employee.findAll();
    console.log("findAll:", allEmployees);

    const filteredEmployees = await Employee.findAll({
      conditions: {
        createdBy: 1,
      },
    });
    console.log("findAll with conditions:", filteredEmployees);

    const pagedEmployees = await Employee.findAll({
      limit: 2,
      offset: 0,
    });
    console.log("findAll pagination:", pagedEmployees);

    const totalEmployees = await Employee.count();
    console.log("count all:", totalEmployees);

    const countFilteredEmployees = await Employee.count({
      createdBy: 1,
    });
    console.log("count filtered:", countFilteredEmployees);

    const updatedEmployee = await Employee.updateById(1, {
      salary: 80000,
      updatedAt: new Date(),
    });
    console.log("updateById:", updatedEmployee);

    const updateManyEmployees = await Employee.updateAll(
      {
        updatedBy: 99,
      },
      {
        createdBy: 1,
      },
    );
    console.log("updateAll:", updateManyEmployees);

    const deletedEmployee = await Employee.deleteById(1);
    console.log("deleteById:", deletedEmployee);

    const deletedOneEmployee = await Employee.deleteOne({
      name: "Priya Nair",
    });
    console.log("deleteOne:", deletedOneEmployee);

    const deletedManyEmployees = await Employee.deleteAll({
      conditions: {
        createdBy: 1,
      },
    });
    console.log("deleteAll:", deletedManyEmployees);
  } catch (err) {
    console.error("Application startup failed:", err);
  } finally {
    try {
      await DB.driver.disconnect();
      console.log("Disconnected from database");
    } catch (err) {
      console.error("Error disconnecting from database:", err);
    }
  }
}

void bootstrap();
