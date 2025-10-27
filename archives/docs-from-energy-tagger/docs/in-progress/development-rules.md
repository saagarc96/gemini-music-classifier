# 🔧 Development Rules and Guidelines

## Ground Rules for Individual Services Implementation

These are the established rules for implementing the individual CRUD services before creating the orchestration layer.

### 📋 Commit Strategy
- ✅ **Commit between every step** using `@agent-git-commit-documenter` for all commits
- ✅ **Commit specifically before testing & after verifying** each component
- ✅ Use the git-commit-documenter agent for all commits throughout the process
- ✅ No manual commits - always use the agent for consistency and proper documentation

### 🧪 Testing Workflow
- ✅ **Local testing first**: Run AI function tests locally to verify core functionality works
- ✅ **Spreadsheet testing second**: User validates with real data on actual Google Sheets
- ✅ **Complete one service fully** before moving to the next service
- ✅ **User verification required** for each step before proceeding

### 📝 Implementation Process
1. **Create**: Build the service and CRUD operations
2. **Integrate**: Add wrapper functions and menu items
3. **Test Locally**: Verify AI functions work with mock data
4. **Deploy**: Push to Google Apps Script
5. **User Test**: Validate on actual spreadsheet
6. **Commit**: Document completion using git-commit-documenter
7. **Move to Next**: Only proceed after full validation

### 🎯 Quality Standards
- ✅ **Zero breaking changes**: Original code remains untouched
- ✅ **Consistent patterns**: Mirror successful energy service structure
- ✅ **Enhanced feedback**: Visual indicators, status updates, progress tracking
- ✅ **Error handling**: Comprehensive error recovery and user feedback
- ✅ **Cache efficiency**: Immediate cached results, smart deduplication

### 🔄 Development Loop
```
Create Service → Test Locally → Deploy → User Validate → Commit → Next Service
```

### 🚨 Important Notes
- **Never skip testing phases** - both local and spreadsheet testing required
- **Always use git-commit-documenter** - no manual commits allowed
- **Maintain todo list** - track progress through each step
- **Follow established patterns** - consistency with energy service is key
- **User approval required** - must validate each service before moving forward

### 📊 Success Criteria
Each service must demonstrate:
- ✅ Identical functionality to original implementation
- ✅ Enhanced status indicators and visual feedback
- ✅ Improved cache efficiency
- ✅ Better error handling and recovery
- ✅ Consistent CRUD patterns

### 🎁 Benefits of This Approach
- **Risk mitigation**: Individual testing prevents cascading failures
- **Clear progress**: Visible milestones with commits between steps
- **Easy debugging**: Isolated services make issues easier to trace
- **User confidence**: Validation at each step builds trust
- **Documentation**: Git history shows clear development progression

---

*These rules ensure systematic, reliable development of the CRUD architecture while maintaining code quality and user confidence.*