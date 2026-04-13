import { User } from "./entities/user.entity.js";
import { Employee } from "./entities/employee.entity.js";

const newUser = new User({
  id: 1,
  name: "John Doe",
  address: "123 Main St",
  dob: new Date("1990-01-01"),
  email: "john.doe@example.com",
  createdAt: new Date(),
  createdBy: 1,
  updatedAt: new Date(),
  updatedBy: 1,
});
await newUser.save();
const deleteAllUser = User.deleteAll({
  conditions: { name: "John" },
  limit: 1,
});
const findAllUser = User.findAll({
  conditions: { name: "John" },
  limit: 10,
  offset: 20,
});
const foundUser = await User.findById(1);

const newEmployee = new Employee({
  id: 1,
  name: "Jane Smith",
  position: "Software Engineer",
  department: "Engineering",
  salary: 90000,
  createdAt: new Date(),
  createdBy: 1,
  updatedAt: new Date(),
  updatedBy: 1,
});
await newEmployee.save();
const foundEmployee = await Employee.findById(1);
const foundAllEmployee = await Employee.findAll();
const deleteEmployee = await Employee.deleteById(2);
const deleteAll = await Employee.deleteAll();
const deleteOne = await Employee.deleteOne({ id: 1, name: "Jane Smith" });
const foundOne = await Employee.findOne({ id: 1 });
