module.exports = {
  prompt({inquirer}) {
    const questions = [
      {
        type: 'select',
        name: 'category',
        message: 'どのカテゴリーで作成しますか？(Which is Category?)',
        choices: ['Parts', 'Organisms', 'Views', 'Pages'],
        initial: 'Parts',
      },
      {
        type: 'input',
        name: 'name',
        message: 'コンポーネント名は何ですか？(What is the name of Component?)',
      },
      {
        type: 'confirm',
        name: 'haveProps',
        message: 'Propsは持ちますか？(Is it have Props?)',
        choices: ['Yes', 'No'],
        initial: 'Yes',
      },
      {
        type: 'confirm',
        name: 'haveHooks',
        message: 'Hooksは持ちますか？(Is it have Hooks?)',
        choices: ['Yes', 'No'],
        initial: 'Yes',
      },
    ];

    return inquirer.prompt(questions).then((answers) => {
      const {haveHooks} = answers;
      const questions = [];
      if (haveHooks) {
        questions.push(
          /*
					{
						type: 'input',
						name: 'hooksName',
						message: 'Hooks名は何ですか？(What is the name of Hooks?)',
					},
					*/
          {
            type: 'select',
            name: 'hooksType',
            message: '初期値の型はどれですか？(Which is Category?)',
            choices: ['undefined', 'Boolean', 'String', 'Number'],
            initial: 'undefined',
          },
        );
      }

      return inquirer.prompt(questions).then((nextAnswers) => {
        const {category} = answers;
        const {hooksType} = nextAnswers;
        const initialState = (() => {
          switch (hooksType) {
            case 'undefined': {
              return 'undefined';
            }

            case 'Boolean': {
              return 'false';
            }

            case 'String': {
              return `''`;
            }

            case 'Number': {
              return '0';
            }

            default: {
              return 'undefined';
            }
          }
        })();
        const skipStories = (() => {
          if (category === 'Pages' || category === 'Views') return true;
          return false;
        })();
        return Object.assign(
          {},
          {...answers, skipStories},
          {...nextAnswers, initialState},
        );
      });
    });
  },
};
