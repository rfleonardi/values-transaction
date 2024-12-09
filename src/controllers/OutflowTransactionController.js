import { PrismaClient } from "@prisma/client";
import useUtils from "../utils/Helper.js";

const prisma = new PrismaClient();
const utils = useUtils();
const emptyFieldError = "Fill in the fields carefully";


const getTargetFromTicketNumber = async(ticketNumber, type, entity, accountNumber) => {
  const result = await prisma.$queryRaw`
      SELECT * FROM Ticket
      JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
      WHERE (
        ${ticketNumber} BETWEEN ticketStart AND ticketEnd
        AND type = ${type}
        AND entity = ${entity}
        AND accountNumber = ${accountNumber}
      )
  `;

  return result
}


const getTicketIdInflow = async (ticketStart, ticketEnd, type, entity, accountNumber) => {
  const result = await prisma.$queryRaw`
      SELECT * FROM Ticket
      JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
      WHERE ${ticketStart} BETWEEN ticketStart AND ticketEnd
        AND ${ticketEnd} BETWEEN ticketStart AND ticketEnd
        AND type = ${type}
        AND entity = ${entity}
        AND accountNumber = ${accountNumber}
  `;

  return result[0] ? result[0].ticketId : null;
}


const invalidTicketStart = async (ticketId, ticketNumber, targetTicket, type, entity, accountNumber) => {
  const result = await prisma.$queryRaw`
    SELECT * FROM Ticket
    JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
    WHERE (
      (
        ${ticketId} = -1
      ) OR (
        ${ticketId} != -1
        AND ticketStart NOT BETWEEN ${targetTicket.ticketStart} AND ${targetTicket.ticketEnd}
      )
    ) AND ${ticketNumber} BETWEEN ticketStart AND ticketEnd
    AND type = ${type}
    AND entity = ${entity}
    AND accountNumber = ${accountNumber}
  `;

  return result.length != 0;
}


const invalidTicketEnd = async (ticketId, ticketNumber, targetTicket, type, entity, accountNumber) => {
  const result = await prisma.$queryRaw`
    SELECT * FROM Ticket
    JOIN Transaction ON Ticket.transactionId = Transaction.transactionId
    WHERE (
      (
        ${ticketId} = -1
      ) OR (
        ${ticketId} != -1
        AND ticketEnd NOT BETWEEN ${targetTicket.ticketStart} AND ${targetTicket.ticketEnd}
      )
    ) AND ${ticketNumber} BETWEEN ticketStart AND ticketEnd
    AND type = ${type}
    AND entity = ${entity}
    AND accountNumber = ${accountNumber}
  `;

  return result.length != 0;
}


const outflowsPerNature = async (accountNumber, exercise, entity) => {
  const date = exercise.length === 4 ? exercise + '-12-12' : exercise;
  const year = exercise.length === 4 ? exercise : (new Date(exercise)).getFullYear().toString();

  const outflows = await prisma.ticket.findMany({
    include: {
      transaction: {
        include: {
          journal: true,
          user: true
        }
      }
    },
    where: {
      transaction: {
        accountNumber: accountNumber,
        type: 'outflow',
        date: {
          startsWith: year,
          lte: date
        },
         entity: entity
      }
    },
    orderBy: {
     ticketStart: 'desc'
    }
  });

  const outflowsFormatted = await utils.formatTransaction(outflows, accountNumber);
  const totalAmount = await utils.getTotalAmount(outflows, accountNumber);
    
  return {
    outflows: outflowsFormatted,
    totalAmount: totalAmount
  };
}


const allOutflows = async (exercise, entity) => {
  const journal = await prisma.journal.findMany();
   
  const amounts = await Promise.all(journal.map(async (item) => {
    return (await outflowsPerNature(item.accountNumber, exercise, entity)).totalAmount
  }));

  const totalAmount = amounts.reduce((acc, amount) => acc + amount, 0);

  return {
    amounts: amounts,
    totalAmount: totalAmount
  };
}


/* select all outflows' transaction per nature */
const getOutflowsPerNature = async (req, res) => {
  const { accountNumber, exercise, entity } = req.body;

  try {
    res.status(200).json(await outflowsPerNature(accountNumber, exercise, entity));
  } catch (error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}


const getAllOutflows = async (req, res) => {
  const { exercise, entity } = req.body;
  
  try {
    res.status(200).json(await allOutflows(exercise, entity));
  } catch (error) {
    console.error(error);
    res.status(500).json({error: error});
  }
}


/* insert or update a accountant's transaction outflow type */
const upsertAccountantOutflow = async (req, res) => {
  let errors = [];
  const { ticketId } = req.params;
  const { orderNumber, ticketStart, ticketEnd, date, accountNumber, userIm, responsible, exercise } = req.body;

  if(!orderNumber && !ticketStart && !ticketEnd && !date && !accountNumber && !userIm)
    errors.push(emptyFieldError);

  try {
    let updatedTicket  = {
      ticketStart: null,
      ticketEnd: null
    };
    let updatedManagerTicket;

    if(ticketId != -1) {
      updatedTicket = await prisma.ticket.findUnique({ where: { ticketId: parseInt(ticketId) }});

      updatedManagerTicket = await prisma.$queryRaw`
        SELECT tk1.* FROM Ticket tk1
        JOIN Transaction ON tk1.transactionId = Transaction.transactionId
        JOIN Ticket tk2 ON (tk1.ticketStart = tk2.ticketStart AND tk1.ticketEnd = tk2.ticketEnd)
        WHERE tk2.ticketId = ${ticketId}
        AND Transaction.type = 'inflow'
        AND Transaction.entity = 'manager'
        AND Transaction.accountNumber = ${accountNumber}
      `;
    }

    if(await utils.invalidOrderNumber(ticketId, orderNumber, exercise, date))
      errors.push("Invalid order number");

    if(ticketStart > ticketEnd)
      errors.push("ticketStart must not greater than ticketEnd");

    const targetFromTicketStart = await getTargetFromTicketNumber(ticketStart, 'inflow', 'accountant', accountNumber);
    const targetFromTicketEnd = await getTargetFromTicketNumber(ticketEnd, 'inflow', 'accountant', accountNumber);

    /* ticket to update */
    const ticketIdInflowFromTargetTicket = await getTicketIdInflow(updatedTicket.ticketStart, updatedTicket.ticketEnd, 'inflow', 'accountant', accountNumber);

    /* values for updating ticket */
    const ticketIdInflowFromUpdatedTicket = await getTicketIdInflow(ticketStart, ticketEnd, 'inflow', 'accountant', accountNumber);

    if(targetFromTicketStart.length === 0 && targetFromTicketEnd.length === 0)
      errors.push("Inflow don't contain these ticketStart and ticketEnd");

    if(targetFromTicketStart.length === 0)
      errors.push("Inflow don't contain this ticketStart");

    if(targetFromTicketEnd.length === 0)
      errors.push("Inflow don't contain this ticketEnd");

    if(targetFromTicketEnd[0].ticketId !== targetFromTicketStart[0].ticketId)
      errors.push("TicketStart and ticketEnd belong two differents inflows");

    const x = await utils.getFirstGreatestStartTicket(ticketStart, 'inflow', 'accountant', accountNumber);
    const y = await utils.getFirstGreatestStartTicket(ticketEnd, 'inflow', 'accountant', accountNumber);

    if(x !== y) 
      errors.push("Check ticketStart or ticketEnd");
    
    const invalidTicketStartOutflow = await invalidTicketStart(ticketId, ticketStart, updatedTicket, 'inflow', 'manager', accountNumber);
    const invalidTicketEndOutflow = await  invalidTicketEnd(ticketId, ticketEnd, updatedTicket, 'inflow', 'manager', accountNumber);

    if((invalidTicketStartOutflow && invalidTicketEndOutflow) || (ticketId != -1 && ticketIdInflowFromTargetTicket != ticketIdInflowFromUpdatedTicket))
      errors.push("Invalid ticketStart and ticketEnd");

    if(invalidTicketStartOutflow)
      errors.push("Invalid ticketStart");

    if(invalidTicketEndOutflow)
      errors.push("Invalid ticketEnd");

    if(ticketId !== -1 && (ticketStart < updatedTicket.ticketStart || ticketEnd > updatedTicket.ticketEnd)) {
      if(errors.indexOf("TicketStart and ticketEnd belong two differents inflows") !== -1)
        errors = errors.splice(errors.indexOf("TicketStart and ticketEnd belong two differents inflows"), 1);

      if(errors.indexOf("Check ticketStart or ticketEnd") !== -1)
        errors = errors.splice(errors.indexOf("TicketStart and ticketEnd belong two differents inflows"), 1);
      
      if(invalidTicketStartOutflow && invalidTicketEndOutflow) 
        errors.push("Invalid ticketStart and ticketEnd");

      if((ticketStart < updatedTicket.ticketStart && ticketEnd <= updatedTicket.ticketEnd) || (ticketStart >= updatedTicket.ticketStart && ticketEnd > updatedTicket.ticketEnd)) {
        if(errors.indexOf("Invalid ticketStart and ticketEnd") !== -1)
          errors = errors.splice(errors.indexOf("Invalid ticketStart and ticketEnd"), 1);
        
        if(ticketStart < updatedTicket.ticketStart && ticketEnd <= updatedTicket.ticketEnd) {
          if(errors.indexOf("Invalid ticketEnd") !== -1)
            errors = errors.splice(errors.indexOf("Invalid ticketEnd"), 1);

          if(invalidTicketStartOutflow)
            errors.push("Invalid ticketStart");
        }

        if(ticketStart >= updatedTicket.ticketStart && ticketEnd > updatedTicket.ticketEnd) {
          if(errors.indexOf("Invalid ticketStart") !== -1)
            errors = errors.splice(errors.indexOf("Invalid ticketStart"), 1);

          if(invalidTicketEndOutflow)
            errors.push("Invalid ticketEnd");
        }
      }
    }

    if(targetFromTicketEnd[0].date > date && await utils.getLastDate(ticketId, ticketStart, 'outflow', 'accountant', accountNumber) > date)
      errors.push("Invalid date");

    const invalidDateOrOrderNumber = await utils.invalidDateOrOrderNumber(orderNumber, ticketStart, date, 'outflow', 'accountant', accountNumber);

    if(invalidDateOrOrderNumber.orderNumber)
      errors.push("Invalid order number by tickets number");

    if(invalidDateOrOrderNumber.date)
      errors.push("Invalid date by tickets number");

    if(errors.length > 0) 
      return res.status(400).json({ errors: errors });

    let ticket, managerTicket;

    if(ticketId == -1) {
      ticket = await prisma.ticket.create({
        data: {
          ticketStart,
          ticketEnd,
          unitPrice: await utils.getUnitPrice(ticketStart, accountNumber),
          transaction: {
            create: {
              orderNumber,
              type: 'outflow',
              entity: 'accountant',
              date,
              responsible,
              accountNumber,
              userIm 
            }
          }
        }
      });

      managerTicket = await prisma.ticket.create({
        data: {
          ticketStart,
          ticketEnd,
          unitPrice: await utils.getUnitPrice(ticketStart, accountNumber),
          transaction: {
            create: {
              orderNumber,
              type: 'inflow',
              entity: 'manager',
              date,
              responsible,
              accountNumber,
              userIm 
            }
          }
        }
      });
    } else {
      ticket = await prisma.ticket.update({
        where: { ticketId: parseInt(ticketId) },
        data: {
          ticketStart,
          ticketEnd,
          transaction: {
            update: {
              orderNumber,
              date,
              responsible,
              userIm 
            }
          }
        }
      });

      managerTicket = await prisma.ticket.update({
        where: { ticketId: parseInt(updatedManagerTicket[0].ticketId) },
        data: {
          ticketStart,
          ticketEnd,
          transaction: {
            update: {
              orderNumber,
              date,
              responsible,
              userIm 
            }
          }
        }
      });
    }

    res.status(201).json({
      message: ticketId == -1 ? "Item added successfully" : "Item updated successfully",
      accountantTicket: ticket,
      managerTicket: managerTicket
    });
  } catch(error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
};


/* insert or update a manager's transaction outflow type */
const upsertManagerOutflow = async (req, res) => {
  let errors = [];
  const { ticketId } = req.params;
  const { orderNumber, ticketStart, ticketEnd, date, accountNumber, userIm, responsible, exercise } = req.body;

  if(!orderNumber && !ticketStart && !ticketEnd && !date && !accountNumber && !userIm)
    errors.push(emptyFieldError);

  try {
    let updatedTicket  = {
      ticketStart: null,
      ticketEnd: null
    };

    if(ticketId != -1)
      updatedTicket = await prisma.ticket.findUnique({ where: { ticketId: parseInt(ticketId) }});
    
    if(await utils.invalidOrderNumber(ticketId, orderNumber, exercise, date))
      errors.push("Invalid order number");

    if(ticketStart > ticketEnd)
      errors.push("ticketStart must not greater than ticketEnd");

    const targetFromTicketStart = await getTargetFromTicketNumber(ticketStart, 'inflow', 'manager', accountNumber);
    const targetFromTicketEnd = await getTargetFromTicketNumber(ticketEnd, 'inflow', 'manager', accountNumber);

    /* ticket to update */
    const ticketIdInflowFromTargetTicket = await getTicketIdInflow(updatedTicket.ticketStart, updatedTicket.ticketEnd, 'inflow', 'manager', accountNumber);

    /* values for updating ticket */
    const ticketIdInflowFromUpdatedTicket = await getTicketIdInflow(ticketStart, ticketEnd, 'inflow', 'manager', accountNumber);
  
    if(targetFromTicketStart.length === 0 && targetFromTicketEnd.length === 0)
      errors.push("Inflow don't contain these ticketStart and ticketEnd");

    if(targetFromTicketStart.length === 0)
      errors.push("Inflow don't contain this ticketStart");

    if(targetFromTicketEnd.length === 0)
      errors.push("Inflow don't contain this ticketEnd");

    if(targetFromTicketEnd[0].ticketId !== targetFromTicketStart[0].ticketId)
      errors.push("TicketStart and ticketEnd belong two differents inflows");

    const x = await utils.getFirstGreatestStartTicket(ticketStart, 'inflow', 'manager', accountNumber);
    const y = await utils.getFirstGreatestStartTicket(ticketEnd, 'inflow', 'manager', accountNumber);

    if(x !== y) 
      errors.push("Check ticketStart or ticketEnd");

    const invalidTicketStartOutflow = await invalidTicketStart(ticketId, ticketStart, updatedTicket, 'outflow', 'manager', accountNumber);
    const invalidTicketEndOutflow = await  invalidTicketEnd(ticketId, ticketEnd, updatedTicket, 'outflow', 'manager', accountNumber);
  
    if((invalidTicketStartOutflow && invalidTicketEndOutflow) || (ticketId != -1 && ticketIdInflowFromTargetTicket != ticketIdInflowFromUpdatedTicket))
      errors.push("Invalid ticketStart and ticketEnd");

    if(invalidTicketStartOutflow)
      errors.push("Invalid ticketStart");

    if(invalidTicketEndOutflow)
      errors.push("Invalid ticketEnd");

    if(ticketId !== -1 && (ticketStart < updatedTicket.ticketStart || ticketEnd > updatedTicket.ticketEnd)) {
      if(errors.indexOf("TicketStart and ticketEnd belong two differents inflows") !== -1)
        errors = errors.splice(errors.indexOf("TicketStart and ticketEnd belong two differents inflows"), 1);

      if(errors.indexOf("Check ticketStart or ticketEnd") !== -1)
        errors = errors.splice(errors.indexOf("TicketStart and ticketEnd belong two differents inflows"), 1);
      
      if(invalidTicketStartOutflow && invalidTicketEndOutflow) 
        errors.push("Invalid ticketStart and ticketEnd");

      if((ticketStart < updatedTicket.ticketStart && ticketEnd <= updatedTicket.ticketEnd) || (ticketStart >= updatedTicket.ticketStart && ticketEnd > updatedTicket.ticketEnd)) {
        if(errors.indexOf("Invalid ticketStart and ticketEnd") !== -1)
          errors = errors.splice(errors.indexOf("Invalid ticketStart and ticketEnd"), 1);
        
        if(ticketStart < updatedTicket.ticketStart && ticketEnd <= updatedTicket.ticketEnd) {
          if(errors.indexOf("Invalid ticketEnd") !== -1)
            errors = errors.splice(errors.indexOf("Invalid ticketEnd"), 1);

          if(invalidTicketStartOutflow)
            errors.push("Invalid ticketStart");
        }

        if(ticketStart >= updatedTicket.ticketStart && ticketEnd > updatedTicket.ticketEnd) {
          if(errors.indexOf("Invalid ticketStart") !== -1)
            errors = errors.splice(errors.indexOf("Invalid ticketStart"), 1);

          if(invalidTicketEndOutflow)
            errors.push("Invalid ticketEnd");
        }
      }
    }

    if(targetFromTicketEnd[0].date > date || await utils.getLastDate(ticketId, ticketStart, 'outflow', 'manager', accountNumber) > date || new Date(date) > new Date())
      errors.push("Invalid date");

    const invalidDateOrOrderNumber = await utils.invalidDateOrOrderNumber(orderNumber, ticketStart, date, 'outflow', 'manager', accountNumber);

    if(invalidDateOrOrderNumber.orderNumber)
      errors.push("Invalid order number by tickets number");

    if(invalidDateOrOrderNumber.date)
      errors.push("Invalid date by tickets number");

    if(errors.length > 0)
      return res.status(400).json({ errors: errors });

    let ticket;

    if(ticketId == -1) {
      ticket = await prisma.ticket.create({
        data: {
          ticketStart,
          ticketEnd,
          unitPrice: await utils.getUnitPrice(ticketStart, accountNumber),
          transaction: {
            create: {
              orderNumber,
              type: 'outflow',
              entity: 'manager',
              date,
              responsible,
              accountNumber,
              userIm 
            }
          }
        }
      });
    } else {
      ticket = await prisma.ticket.update({
        where: { ticketId: parseInt(ticketId) },
        data: {
          ticketStart,
          ticketEnd,
          transaction: {
            update: {
              orderNumber,
              date,
              responsible,
              userIm 
            }
          }
        }
      });
    }

    res.status(201).json({
      message: ticketId == -1 ? "Item added successfully" : "Item updated successfully",
      accountantTicket: ticket,
    });
  } catch(error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
}


export {
  getOutflowsPerNature,
  getAllOutflows,
  upsertAccountantOutflow,
  upsertManagerOutflow
}