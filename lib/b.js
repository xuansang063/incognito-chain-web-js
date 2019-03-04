import {aMethod} from './a'

console.log('b', b, aMethod)

function bMethod(){
  console.log('bMethod', bMethod)
}

module.exports = {aMethod, bMethod}