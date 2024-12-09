import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const emptyRequestError = "Fill in the fields carefully";


/* User register */
const registerUser = async (req, res) => {
  try {
    const { userIm, username, password } = req.body;
    const user = await prisma.user.findFirst({ where: { userIm } });

    if(!username && !password)
      return res.status(400).json({ error: emptyRequestError });

    if(user)
      return res.status(400).json({ error: "Immatriculation already exists" });

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const createdUser = await prisma.user.create({
      data: {
        userIm,
        username,
        password: hashedPassword,
      }
    });

    res.status(201).json({
      message: "User registered successfully",
      user: createdUser
    });
  } catch(error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
}


/* User login */
const loginUser = async (req, res) => {
  try {
    const { userIm, password } = req.body;
    const user = await prisma.user.findUnique({ where: { userIm } });

    if(!userIm && !password)
      return res.status(400).json({ error: emptyRequestError });

    if(!user)
      return res.status(400).json({ error: "Immatriculation not found" });
    
    const comparePassword = await bcryptjs.compare(password, user.password);

    if(!comparePassword)
      return res.status(400).json({ error: "Incorrect password" });
      
    const payload = {
      userIm: user.userIm,
      username: user.username
    }

    jwt.sign(payload, process.env.JWTSECRET, (err, token) => {
      if(err || !token)
        return res.status(401).json({ error: "Token not found" });
      res.status(200).json(token);
    })
  } catch(error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
}

const getUser = async (req, res) => {
  const { userIm } = req.params;

  const user = await prisma.user.findUnique({ 
    where: { userIm: userIm },
    select: {
      userIm: true,
      username: true
    }
  });

  res.status(200).json(user);
}

/* User edition: forgotten password, security, information */
const updateUser = async (req, res) => {
  const { im } = req.params;
  const { userIm, username, actualPassword, password } = req.body;
  
  let updatedUser;

  if(password === undefined) {
    const user = await prisma.user.findUnique({ where: { 
      NOT: { userIm: im },
      userIm: userIm
    }});

    if(!userIm && !username)
      return res.status(400).json({ error: emptyRequestError });

    if(user)
      return res.status(400).json({ error: "Invalid immatriculation" });
    
    updatedUser = await prisma.user.update({
      where: { userIm: im },
      data: {
        userIm,
        username
      }
    });
  } else {
    let targetUser = await prisma.user.findUnique({ where: { userIm: im }} );

    if(!password && !actualPassword)
      return res.status(400).json({ error: emptyRequestError });

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const comparePassword = await bcryptjs.compare(actualPassword, targetUser.password);

    if(!comparePassword)
      return res.status(400).json({ error: 'Incorrect actual password' });

    if(actualPassword === password)
      return res.status(200).json({ error: 'new password can\'t be equal to the actual password' });

    updatedUser = await prisma.user.update({
      where: { userIm: im },
      data: {
        password: hashedPassword,
      }
    });
  }

  res.status(200).json({
    message: "User updated successfully",
    user: updatedUser
  });
}


const resetPassword = async (req, res) => {
  try {
    const { userIm, password } = req.body;
    const targetUser = await prisma.user.findUnique({ where: { userIm}} );

    if(!userIm && !password)
      return res.status(400).json({ error: emptyRequestError });

    if(!targetUser)
      return res.status(400).json({ error: "Immatriculation not found" });

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const user = await prisma.user.update({
      where: { userIm: userIm },
      data: {
        password: hashedPassword
      }
    });

    return res.status(200).json({
      message: "User updated successfully",
      user: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
}


export {
  registerUser,
  loginUser,
  getUser,
  updateUser,
  resetPassword
}