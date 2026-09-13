import express from "express";
import addNumbers from "@rummy/utils";

const app = express();


const PORT = 3000;


app.get('/', (req, res) => {
    const answer: number = addNumbers(7, 7);
    return res.send(`<h1> Hello I am using express ${answer}</h1>`);
})


app.listen(PORT, () => {
    console.log(`Server is listening at port: ${PORT}`);
})
