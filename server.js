const express = require('express')
const Handlebars = require('handlebars')
const expressHandlebars = require('express-handlebars')
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access')
const { response } = require('express')
const app = express()
const {Board,Task,User,sequelize} = require("./models")

const handlebars = expressHandlebars({
    handlebars: allowInsecurePrototypeAccess(Handlebars)
})

app.use(express.static('public'))
app.engine('handlebars', handlebars)
app.set('view engine', 'handlebars')
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
async function sync() {
 await sequelize.sync()
}
sync()
app.listen(3000, () => console.log('web server running on port 3000'))

//---------rendering create User page ------

app.get('/users/create',(req,res)=>{
    res.render('createUser')
})

//------rendering create board page-----
app.get('/boards/create',(req,res)=>{
    res.render('createBoard')
})


//--------create board ------

app.post('/boards/create',async (req,res)=>{
    console.log('creating board')
    const board = await Board.create({name:req.body.name,description:req.body.description,})
    res.redirect(`/boards/${board.id}`)
})


//--------create user ------

app.post('/users/create',async (req,res)=>{
    console.log('creating user')
    const user = await User.create({username:req.body.username,avatar:req.body.avatar})
    res.redirect(`/users/${user.id}`)
})

//-----rendering home page-----

app.get('/',async (req,res)=>{
    const boards = await Board.findAll({
        include: [{model:User}],
        nest: true
    })
    res.render('home',{boards})
})

//----create task -----

app.post('/boards/:boardid/tasks/create',async (req,res) =>{
    const task = await Task.create({taskName:req.body.taskName,taskDescription:req.body.taskDescription,status:req.body.status,priority:req.body.priority,deadline:req.body.deadline})
    const board = await Board.findByPk(req.params.boardid)
    await board.addTask(task)
    res.redirect(`/boards/${req.params.boardid}`)
})

//----edit board------

app.post('/boards/:boardid/edit',async (req,res) =>{
    const board = await Board.findByPk(req.params.boardid)
    await board.update({name:req.body.name,description:req.body.description})
    res.redirect(`/boards/${req.params.boardid}`)
})

//-----edit user-------

app.post('/users/:userid/edit',async (req,res) =>{
    const user = await User.findByPk(req.params.userid)
    await user.update({username:req.body.username,avatar:req.body.avatar})
    res.redirect(`/boards/${req.params.boardid}`)
})

//-----destroy user ----

app.post('/user/:userid/delete', async ()=>{
    await Task.findByPk(req.params.userid).then(user =>{
        user.destroy()
    })
    res.redirect('/')
})

//-----destroy task ----
app.post('/boards/:boardid/tasks/:taskid/delete', async ()=>{
    await Task.findByPk(req.params.taskid).then(task =>{
        task.destroy()
    })
    res.redirect(`/boards/${req.params.boardid}`)
})

//-----destroy board ----

app.post('/boards/:boardid/delete', async ()=>{
    await Board.findByPk(req.params.boardid).then(board =>{
        board.destroy()
    })
    res.redirect('/')
})
