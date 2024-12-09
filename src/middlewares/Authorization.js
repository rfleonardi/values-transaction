import jwt from "jsonwebtoken";

const authorisation = (req, res, next) => {
  const token = req.header('Authorization');

  if(!token)
    return res.status(401).json({ message: "Access denied, no token provided"});

  try {
    const decoded = jwt.verify(token, process.env.JWTSECRET);
    req.user = decoded;
    next();
  } catch(error) {
    res.status(400).json({ 
      message: "Invalid token",
      error: error
    });
  }
}

export default authorisation;